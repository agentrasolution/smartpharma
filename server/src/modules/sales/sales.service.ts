import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import { emitEvent } from "../../socket";
import type { CreateSaleInput } from "./sales.schema";
import { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";
import { batchService } from "../inventory/batch.service";

function branchWhere(scope: BranchScope): Prisma.SaleWhereInput {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

export const salesService = {
  async create(data: CreateSaleInput, scope: BranchScope) {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const prefix = `${yy}${mm}-`;

    const last = await prisma.sale.findFirst({
      where: { id: { startsWith: prefix }, ...branchWhere(scope) },
      orderBy: { id: "desc" },
    });

    let nextNum = 1;
    if (last) {
      nextNum = parseInt(last.id.slice(-6), 10) + 1;
    }
    const saleId = `${prefix}${nextNum.toString().padStart(6, "0")}`;

    const paymentMethod = data.paymentMethod ?? "CASH";
    let cashAmount = data.cashAmount ?? 0;
    let cardAmount = data.cardAmount ?? 0;
    let creditAmount = data.creditAmount ?? 0;

    if (paymentMethod === "CASH" && cashAmount === 0) {
      cashAmount = data.amountPaid;
    } else if (paymentMethod === "CARD" && cardAmount === 0) {
      cardAmount = data.amountPaid;
    }

    if (data.amountPaid < data.total) {
      creditAmount = data.total - data.amountPaid;
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const sale = await tx.sale.create({
        data: {
          id: saleId,
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
          customerId: data.customerId ?? null,
          subtotal: data.subtotal,
          discount: data.discount,
          total: data.total,
          amountPaid: data.amountPaid,
          change: Math.max(0, data.amountPaid - data.total),
          status: data.amountPaid >= data.total ? "paid" : "partial",
          paymentMethod,
          cashAmount,
          cardAmount,
          creditAmount,
          prescriptionId: data.prescriptionId ?? null,
          prescriptionNumber: data.prescriptionNumber ?? null,
          cashierId: data.cashierId ?? null,
          cashierName: data.cashierName ?? null,
          notes: data.notes ?? "",
        },
      });

      let totalCogs = 0;
      let totalVat = 0;

      for (const item of data.items) {
        let allocatedBatchId: string | null = item.batchId ?? null;
        let allocatedBatchNumber: string | null = item.batchNumber ?? null;
        let allocatedExpiry: Date | null = item.expiryDate ? new Date(item.expiryDate) : null;
        let itemUnitCost = 0;

        // ----------------------------------------------------------------
        // Specific batch selection or FEFO batch deduction
        // ----------------------------------------------------------------
        if (item.batchId) {
          const specificBatch = await tx.batch.findFirst({
            where: {
              id: item.batchId,
              pharmacyId: scope.pharmacyId,
              branchId: scope.branchId!,
            },
          });

          if (specificBatch) {
            allocatedBatchNumber = specificBatch.batchNumber;
            allocatedExpiry = specificBatch.expiryDate;
            itemUnitCost = Number(specificBatch.costPricePerUnit);
            const newQty = Math.max(0, specificBatch.quantityInBaseUnits - item.quantity);
            await tx.batch.update({
              where: { id: specificBatch.id },
              data: {
                quantityInBaseUnits: newQty,
                status: newQty === 0 ? "DEPLETED" : "ACTIVE",
              },
            });

            await tx.stockMovement.create({
              data: {
                pharmacyId: scope.pharmacyId,
                branchId: scope.branchId!,
                productId: item.productId,
                batchId: specificBatch.id,
                movementType: "SALE",
                quantityDelta: -item.quantity,
                balanceAfter: newQty,
                unitCost: specificBatch.costPricePerUnit,
                referenceNumber: sale.id,
              },
            });
          }
        } else {
          // Automatic FEFO allocation
          const activeBatches = await tx.batch.count({
            where: {
              pharmacyId: scope.pharmacyId,
              branchId: scope.branchId!,
              productId: item.productId,
              status: "ACTIVE",
              quantityInBaseUnits: { gt: 0 },
              isRecalled: false,
            },
          });

          if (activeBatches > 0) {
            const allocations = await batchService.allocateFefo(tx, scope, item.productId, item.quantity, {
              movementType: "SALE",
              referenceNumber: sale.id,
            });

            if (allocations.length > 0) {
              const firstBatch = await tx.batch.findUnique({
                where: { id: allocations[0].batchId },
                select: { id: true, batchNumber: true, expiryDate: true, costPricePerUnit: true },
              });
              if (firstBatch) {
                allocatedBatchId = firstBatch.id;
                allocatedBatchNumber = firstBatch.batchNumber;
                allocatedExpiry = firstBatch.expiryDate;
                if (firstBatch.costPricePerUnit != null) {
                  const parsed = Number(firstBatch.costPricePerUnit);
                  if (!isNaN(parsed) && parsed > 0) itemUnitCost = parsed;
                }
              }
            }
          } else {
            // Legacy path: no batches registered yet
            const currentStockAgg = await tx.batch.aggregate({
              where: {
                pharmacyId: scope.pharmacyId,
                branchId: scope.branchId!,
                productId: item.productId,
              },
              _sum: { quantityInBaseUnits: true },
            });
            await tx.stockMovement.create({
              data: {
                pharmacyId: scope.pharmacyId,
                branchId: scope.branchId!,
                productId: item.productId,
                batchId: null,
                movementType: "SALE",
                quantityDelta: -item.quantity,
                balanceAfter: Math.max(0, (currentStockAgg._sum.quantityInBaseUnits ?? 0) - item.quantity),
                unitCost: 0,
                referenceNumber: sale.id,
              },
            });
          }
        }

        // Keep product.stockQty in sync
        const currentProd = await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
          select: { purchasePrice: true, category: true },
        });

        if ((!itemUnitCost || isNaN(itemUnitCost)) && currentProd) {
          itemUnitCost = Number(currentProd.purchasePrice) || 0;
        }
        if (isNaN(itemUnitCost)) {
          itemUnitCost = 0;
        }

        const lineCogs = Math.round(itemUnitCost * item.quantity * 100) / 100;
        totalCogs += lineCogs;

        // Check category VAT rate
        let vatRate = 0;
        if (currentProd?.category) {
          const cat = await tx.category.findFirst({
            where: { pharmacyId: scope.pharmacyId, name: currentProd.category },
            select: { vatRate: true },
          });
          if (cat?.vatRate) vatRate = cat.vatRate;
        }
        const vatAmount = vatRate > 0 ? Math.round((item.subtotal * (vatRate / 100)) * 100) / 100 : 0;
        totalVat += vatAmount;

        // Create SaleItem with allocated batch info, unitCost & COGS
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            productName: item.productName,
            barcode: item.barcode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            unitCost: itemUnitCost,
            cogs: lineCogs,
            vatRate,
            vatAmount,
            batchId: allocatedBatchId,
            batchNumber: allocatedBatchNumber,
            expiryDate: allocatedExpiry,
          },
        });
      }

      // Update sale totals with COGS, VAT, and gross profit
      const subtotalVal = sale.subtotal != null ? sale.subtotal : (sale.total ?? 0);
      const discountVal = sale.discount ?? 0;
      const netRevenue = Math.max(0, subtotalVal - discountVal);
      const grossProfit = Math.round((netRevenue - totalCogs) * 100) / 100;
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          totalCogs,
          totalVat,
          grossProfit,
        },
      });

      // If prescription linked, update prescription items
      if (data.prescriptionId) {
        const rx = await tx.prescription.findFirst({
          where: { id: data.prescriptionId, pharmacyId: scope.pharmacyId },
          include: { items: true },
        });

        if (rx) {
          for (const sItem of data.items) {
            const rxItem = rx.items.find(
              (i) => i.productId === sItem.productId || i.prescribedDrugName.toLowerCase() === sItem.productName.toLowerCase()
            );
            if (rxItem && rxItem.quantityRemaining > 0) {
              const dispensedNow = Math.min(rxItem.quantityRemaining, sItem.quantity);
              const newRemaining = rxItem.quantityRemaining - dispensedNow;
              await tx.prescriptionItem.update({
                where: { id: rxItem.id },
                data: {
                  quantityDispensed: rxItem.quantityDispensed + dispensedNow,
                  quantityRemaining: newRemaining,
                  status: newRemaining === 0 ? "COMPLETED" : "PARTIAL",
                },
              });
            }
          }

          const remainingItems = await tx.prescriptionItem.findMany({
            where: { prescriptionId: rx.id },
          });
          const allDone = remainingItems.every((i) => i.quantityRemaining === 0);
          await tx.prescription.update({
            where: { id: rx.id },
            data: { status: allDone ? "FULLY_DISPENSED" : "PARTIALLY_DISPENSED" },
          });
        }
      }

      if (data.amountPaid < data.total && data.customerId) {
        await tx.arrear.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId: scope.branchId!,
            saleId: sale.id,
            customerId: data.customerId,
            totalBill: data.total,
            amountPaid: data.amountPaid,
            balanceDue: data.total - data.amountPaid,
            status: "pending",
          },
        });
      }

      const result = await tx.sale.findUnique({
        where: { id: sale.id },
        include: { items: true, customer: true },
      });

      emitEvent("sale:created", result);
      return result;
    });
  },

  async listRecent(scope: BranchScope, limit = 10) {
    return prisma.sale.findMany({
      where: branchWhere(scope),
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true, returns: true } },
      },
    });
  },

  async listByDate(scope: BranchScope, dateStr: string, tzOffsetMinutes?: number) {
    const offsetMs = (tzOffsetMinutes ?? 0) * 60000;
    const start = new Date(`${dateStr}T00:00:00.000Z`).getTime() - offsetMs;
    const end = start + 24 * 60 * 60 * 1000 - 1;

    return prisma.sale.findMany({
      where: {
        ...branchWhere(scope),
        createdAt: { gte: new Date(start), lte: new Date(end) },
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true, returns: true } },
      },
    });
  },

  async search(scope: BranchScope, q: string, limit = 50) {
    const query = q.trim();
    return prisma.sale.findMany({
      where: {
        ...branchWhere(scope),
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { customer: { is: { name: { contains: query, mode: "insensitive" } } } },
          { items: { some: { productName: { contains: query, mode: "insensitive" } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true, returns: true } },
      },
    });
  },

  async listAll(scope: BranchScope, opts?: { search?: string; dateFrom?: string; dateTo?: string; tzOffsetMinutes?: number }) {
    const where: Record<string, unknown> = { ...branchWhere(scope) };
    const offsetMs = (opts?.tzOffsetMinutes ?? 0) * 60000;

    if (opts?.dateFrom || opts?.dateTo) {
      where.createdAt = {};
      if (opts.dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(new Date(`${opts.dateFrom}T00:00:00.000Z`).getTime() - offsetMs);
      }
      if (opts.dateTo) {
        (where.createdAt as Record<string, Date>).lte = new Date(new Date(`${opts.dateTo}T23:59:59.999Z`).getTime() - offsetMs);
      }
    }

    const search = opts?.search?.trim();
    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { customer: { is: { name: { contains: search, mode: "insensitive" } } } },
        { items: { some: { productName: { contains: search, mode: "insensitive" } } } },
      ];
    }

    return prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true, returns: true } },
      },
    });
  },

  async getById(scope: BranchScope, id: string) {
    const sale = await prisma.sale.findFirst({
      where: { id, ...branchWhere(scope) },
      include: {
        customer: { select: { name: true } },
        items: true,
        returns: { include: { items: true } },
        _count: { select: { returns: true } },
      },
    });
    if (!sale) throw new NotFoundError("Sale");
    return sale;
  },
};
