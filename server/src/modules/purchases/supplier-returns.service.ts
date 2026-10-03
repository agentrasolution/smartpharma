import { prisma } from "../../services/prisma";
import { NotFoundError, BadRequestError } from "../../utils/errors";
import type { BranchScope } from "../../middleware/auth";
import type {
  CreateSupplierReturnInput,
  ApproveSupplierReturnInput,
  ListSupplierReturnsQuery,
} from "./supplier-returns.schema";
import { emitEvent } from "../../socket";

function normalizeSupplierReturn(r: any) {
  return {
    ...r,
    totalAmount: Number(r.totalAmount || 0),
    items: (r.items || []).map((it: any) => ({
      ...it,
      unitCost: Number(it.unitCost || 0),
      totalCost: Number(it.totalCost || 0),
    })),
  };
}

export const supplierReturnsService = {
  async list(scope: BranchScope, query: ListSupplierReturnsQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      pharmacyId: scope.pharmacyId,
    };

    if (scope.branchId) {
      where.branchId = scope.branchId;
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    if (query.distributorId) {
      where.distributorId = query.distributorId;
    }

    if (query.reason) {
      where.reason = query.reason;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { returnNumber: { contains: s, mode: "insensitive" } },
        { creditNoteNumber: { contains: s, mode: "insensitive" } },
        { notes: { contains: s, mode: "insensitive" } },
        { distributor: { name: { contains: s, mode: "insensitive" } } },
      ];
    }

    if (query.from || query.to) {
      where.returnDate = {};
      if (query.from) where.returnDate.gte = new Date(query.from);
      if (query.to) where.returnDate.lte = new Date(query.to);
    }

    const [total, returns] = await Promise.all([
      prisma.supplierReturn.count({ where }),
      prisma.supplierReturn.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { returnDate: "desc" },
        include: {
          distributor: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, barcode: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: returns.map(normalizeSupplierReturn),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async getById(scope: BranchScope, id: string) {
    const ret = await prisma.supplierReturn.findFirst({
      where: {
        id,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      include: {
        distributor: { select: { id: true, name: true, phone: true, address: true } },
        branch: { select: { id: true, name: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            balanceDue: true,
            status: true,
          },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true, category: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true, quantity: true } },
          },
        },
      },
    });

    if (!ret) throw new NotFoundError("Supplier Return");
    return normalizeSupplierReturn(ret);
  },

  async getCandidates(scope: BranchScope, distributorId?: string, days = 90) {
    const branchId = scope.branchId;
    if (!branchId) {
      throw new BadRequestError("Branch scope is required to evaluate stock return candidates");
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Number(days));

    // Find batches in branch expiring within days, or already expired, or recalled, with quantity > 0
    const batches = await prisma.batch.findMany({
      where: {
        branchId,
        quantity: { gt: 0 },
        OR: [
          { expiryDate: { lte: targetDate } },
          { isRecalled: true },
          { status: { in: ["EXPIRED", "QUARANTINED"] } },
        ],
        ...(distributorId
          ? {
              product: {
                distributorId,
              },
            }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            category: true,
            distributorId: true,
            pack_size: true,
            distributor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { expiryDate: "asc" },
      take: 100,
    });

    const now = new Date();
    return batches.map((b) => {
      const exp = new Date(b.expiryDate);
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let suggestedReason = "NEAR_EXPIRY";
      if (b.isRecalled) suggestedReason = "RECALLED";
      else if (diffDays <= 0) suggestedReason = "EXPIRED";

      return {
        batchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate.toISOString(),
        daysToExpiry: diffDays,
        quantityAvailable: b.quantity,
        unitCost: Number(b.costPrice || 0),
        suggestedReason,
        productId: b.productId,
        productName: b.product.name,
        barcode: b.product.barcode,
        packSize: b.product.pack_size || 1,
        distributorId: b.product.distributorId,
        distributorName: b.product.distributor?.name || "Unknown Distributor",
      };
    });
  },

  async create(
    scope: BranchScope,
    user: { id: string; name?: string; username?: string },
    input: CreateSupplierReturnInput,
  ) {
    const branchId = scope.branchId;
    if (!branchId) {
      throw new BadRequestError("Branch ID is required to create a supplier return");
    }

    const distributor = await prisma.distributor.findFirst({
      where: { id: input.distributorId, pharmacyId: scope.pharmacyId },
    });
    if (!distributor) throw new NotFoundError("Distributor");

    if (input.invoiceId) {
      const invoice = await prisma.purchaseInvoice.findFirst({
        where: { id: input.invoiceId, pharmacyId: scope.pharmacyId },
      });
      if (!invoice) throw new NotFoundError("Purchase Invoice");
    }

    // Generate unique Return Number: RTV-YYYYMM-XXXX
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `RTV-${yyyy}${mm}-`;

    const lastReturn = await prisma.supplierReturn.findFirst({
      where: {
        pharmacyId: scope.pharmacyId,
        returnNumber: { startsWith: prefix },
      },
      orderBy: { returnNumber: "desc" },
      select: { returnNumber: true },
    });

    let seq = 1;
    if (lastReturn?.returnNumber) {
      const parts = lastReturn.returnNumber.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const returnNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    // Verify stock availability for each item in the branch
    let calculatedTotal = 0;
    const preparedItems = [];

    for (const it of input.items) {
      const product = await prisma.product.findFirst({
        where: { id: it.productId, branchId },
      });
      if (!product) throw new NotFoundError(`Product ${it.productId}`);

      const unitsPerPack = it.unitsPerPack || product.pack_size || 1;
      const quantityBaseUnits = it.quantityPacks * unitsPerPack;
      const unitCost = Number(it.unitCost || 0);
      const totalCost = unitCost * it.quantityPacks;
      calculatedTotal += totalCost;

      // If batch specified or exists, check current quantity
      let batchId = it.batchId;
      if (!batchId && it.batchNumber) {
        const foundBatch = await prisma.batch.findFirst({
          where: { branchId, productId: it.productId, batchNumber: it.batchNumber },
        });
        if (foundBatch) batchId = foundBatch.id;
      }

      preparedItems.push({
        productId: it.productId,
        productName: product.name,
        batchId: batchId || null,
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
        quantityPacks: it.quantityPacks,
        unitsPerPack,
        quantityBaseUnits,
        unitCost,
        totalCost,
        reason: it.reason || input.reason || "",
      });
    }

    const userName = user.name || user.username || "Pharmacist";

    // Create the SupplierReturn record in DB transaction
    const newReturn = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierReturn.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId,
          distributorId: input.distributorId,
          returnNumber,
          returnDate: new Date(),
          invoiceId: input.invoiceId || null,
          status: input.autoApprove ? "APPROVED" : "PENDING",
          totalAmount: calculatedTotal,
          creditNoteNumber: input.creditNoteNumber || null,
          reason: input.reason,
          notes: input.notes || "",
          createdById: user.id,
          createdByName: userName,
          approvedById: input.autoApprove ? user.id : null,
          approvedByName: input.autoApprove ? userName : null,
          approvedAt: input.autoApprove ? new Date() : null,
          items: {
            create: preparedItems.map((p) => ({
              productId: p.productId,
              batchId: p.batchId,
              batchNumber: p.batchNumber,
              expiryDate: p.expiryDate,
              quantityPacks: p.quantityPacks,
              unitsPerPack: p.unitsPerPack,
              quantityBaseUnits: p.quantityBaseUnits,
              unitCost: p.unitCost,
              totalCost: p.totalCost,
              reason: p.reason,
            })),
          },
        },
        include: {
          distributor: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          items: true,
        },
      });

      // If autoApprove, execute inventory deduction and ledger credit note immediately
      if (input.autoApprove) {
        for (const item of preparedItems) {
          // Decrement batch if exists
          if (item.batchId) {
            const batch = await tx.batch.findUnique({ where: { id: item.batchId } });
            if (batch) {
              const newBatchQty = Math.max(0, batch.quantity - item.quantityBaseUnits);
              await tx.batch.update({
                where: { id: item.batchId },
                data: { quantity: newBatchQty },
              });
            }
          }

          // Decrement product stock
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          const newProdStock = Math.max(0, (prod?.stock_qty || 0) - item.quantityBaseUnits);
          await tx.product.update({
            where: { id: item.productId },
            data: { stock_qty: newProdStock },
          });

          // Log stock movement
          await tx.stockMovement.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId,
              productId: item.productId,
              batchId: item.batchId,
              movementType: "SUPPLIER_RETURN",
              quantityDelta: -item.quantityBaseUnits,
              balanceAfter: newProdStock,
              unitCost: item.unitCost,
              referenceNumber: returnNumber,
              reasonCode: item.reason || input.reason,
              createdById: user.id,
            },
          });
        }

        // Reconcile Invoice if linked
        if (input.invoiceId) {
          const inv = await tx.purchaseInvoice.findUnique({ where: { id: input.invoiceId } });
          if (inv) {
            const curBal = Number(inv.balanceDue);
            const newBal = Math.max(0, curBal - calculatedTotal);
            await tx.purchaseInvoice.update({
              where: { id: input.invoiceId },
              data: {
                balanceDue: newBal,
                status: newBal <= 0 ? "PAID" : inv.status,
              },
            });
          }
        }

        // Post Credit Note to Distributor Ledger via DistributorPayment
        await tx.distributorPayment.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId,
            distributorId: input.distributorId,
            invoiceId: input.invoiceId || null,
            amount: calculatedTotal,
            paymentMethod: "CREDIT_NOTE",
            referenceNumber: input.creditNoteNumber || returnNumber,
            paidAt: new Date(),
            notes: `RTV Credit Memo #${returnNumber} (${input.reason})`,
          },
        });
      }

      return created;
    });

    emitEvent("supplier:return_created", newReturn);
    return normalizeSupplierReturn(newReturn);
  },

  async approve(
    scope: BranchScope,
    user: { id: string; name?: string; username?: string },
    id: string,
    input: ApproveSupplierReturnInput,
  ) {
    const existing = await prisma.supplierReturn.findFirst({
      where: {
        id,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      include: { items: true },
    });

    if (!existing) throw new NotFoundError("Supplier Return");
    if (existing.status === "APPROVED" || existing.status === "COMPLETED") {
      throw new BadRequestError("Supplier return has already been approved");
    }
    if (existing.status === "REJECTED") {
      throw new BadRequestError("Cannot approve a rejected supplier return");
    }

    const userName = user.name || user.username || "Supervisor";
    const totalAmount = Number(existing.totalAmount || 0);

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Deduct stock for all items
      for (const item of existing.items) {
        if (item.batchId) {
          const batch = await tx.batch.findUnique({ where: { id: item.batchId } });
          if (batch) {
            const newBatchQty = Math.max(0, batch.quantity - item.quantityBaseUnits);
            await tx.batch.update({
              where: { id: item.batchId },
              data: { quantity: newBatchQty },
            });
          }
        }

        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        const newProdStock = Math.max(0, (prod?.stock_qty || 0) - item.quantityBaseUnits);
        await tx.product.update({
          where: { id: item.productId },
          data: { stock_qty: newProdStock },
        });

        await tx.stockMovement.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId: existing.branchId,
            productId: item.productId,
            batchId: item.batchId,
            movementType: "SUPPLIER_RETURN",
            quantityDelta: -item.quantityBaseUnits,
            balanceAfter: newProdStock,
            unitCost: item.unitCost,
            referenceNumber: existing.returnNumber,
            reasonCode: item.reason || existing.reason,
            createdById: user.id,
          },
        });
      }

      // 2. Reconcile purchase invoice if linked
      if (existing.invoiceId) {
        const inv = await tx.purchaseInvoice.findUnique({ where: { id: existing.invoiceId } });
        if (inv) {
          const curBal = Number(inv.balanceDue);
          const newBal = Math.max(0, curBal - totalAmount);
          await tx.purchaseInvoice.update({
            where: { id: existing.invoiceId },
            data: {
              balanceDue: newBal,
              status: newBal <= 0 ? "PAID" : inv.status,
            },
          });
        }
      }

      // 3. Post Credit Note to Distributor Ledger
      await tx.distributorPayment.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId: existing.branchId,
          distributorId: existing.distributorId,
          invoiceId: existing.invoiceId || null,
          amount: totalAmount,
          paymentMethod: "CREDIT_NOTE",
          referenceNumber: input.creditNoteNumber || existing.returnNumber,
          paidAt: input.creditNoteDate ? new Date(input.creditNoteDate) : new Date(),
          notes: `RTV Credit Memo #${existing.returnNumber}${input.notes ? ` - ${input.notes}` : ""}`,
        },
      });

      // 4. Update status of return to APPROVED / COMPLETED
      return tx.supplierReturn.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedByName: userName,
          approvedAt: new Date(),
          creditNoteNumber: input.creditNoteNumber || existing.creditNoteNumber,
          creditNoteDate: input.creditNoteDate ? new Date(input.creditNoteDate) : null,
          notes: input.notes ? `${existing.notes}\nApproval Notes: ${input.notes}`.trim() : existing.notes,
        },
        include: {
          distributor: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          items: true,
        },
      });
    });

    emitEvent("supplier:return_approved", updated);
    return normalizeSupplierReturn(updated);
  },

  async reject(
    scope: BranchScope,
    user: { id: string; name?: string; username?: string },
    id: string,
    reason: string,
  ) {
    const existing = await prisma.supplierReturn.findFirst({
      where: {
        id,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
    });

    if (!existing) throw new NotFoundError("Supplier Return");
    if (existing.status === "APPROVED" || existing.status === "COMPLETED") {
      throw new BadRequestError("Cannot reject an already approved supplier return");
    }

    const updated = await prisma.supplierReturn.update({
      where: { id },
      data: {
        status: "REJECTED",
        notes: `${existing.notes}\nRejected: ${reason}`.trim(),
      },
      include: {
        distributor: { select: { id: true, name: true } },
        items: true,
      },
    });

    emitEvent("supplier:return_rejected", updated);
    return normalizeSupplierReturn(updated);
  },
};
