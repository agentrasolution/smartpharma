import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import { emitEvent } from "../../socket";
import type {
  CreateStockInput,
  CreatePurchaseInvoiceInput,
  RecordSupplierPaymentInput,
  ListInvoicesQuery,
} from "./purchases.schema";
import { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";
import { normalizePurchaseInvoice, normalizePurchaseInvoiceList } from "../../utils/normalize";

function branchWhere(scope: BranchScope) {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

async function resolveBranchId(scope: BranchScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const branch = await prisma.branch.findFirst({
    where: { pharmacyId: scope.pharmacyId },
    orderBy: { createdAt: "asc" },
  });
  if (!branch) {
    throw new BadRequestError("No pharmacy branch found to record inventory");
  }
  return branch.id;
}

export const purchasesService = {
  // =========================================================================
  // LEGACY SINGLE-ITEM STOCK PURCHASES (Preserved for backwards compatibility)
  // =========================================================================
  async list(scope: BranchScope) {
    return prisma.stockPurchase.findMany({
      where: branchWhere(scope),
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true } },
        distributor: { select: { name: true } },
        company: { select: { name: true } },
      },
    });
  },

  async create(scope: BranchScope, data: CreateStockInput) {
    const branchId = await resolveBranchId(scope);
    const product = await prisma.product.findFirst({
      where: { id: data.productId, pharmacyId: scope.pharmacyId },
      select: { purchasePrice: true, salePrice: true, unitsPerPack: true },
    });

    const price = product?.purchasePrice ?? 0;
    const salePrice = product?.salePrice ?? 0;
    const unitsPerPack = product?.unitsPerPack ?? 1;
    const baseUnitsReceived = data.quantity * unitsPerPack;
    const totalValue = data.quantity * price;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const stockPurchase = await tx.stockPurchase.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId,
          productId: data.productId,
          distributorId: data.distributorId ?? null,
          companyId: data.companyId ?? null,
          invoiceNumber: data.invoiceNumber ?? "",
          quantity: data.quantity,
          purchasePrice: price,
          salePrice,
          expiry: data.expiry ?? null,
          totalValue,
        },
        include: {
          product: { select: { name: true } },
          distributor: { select: { name: true } },
          company: { select: { name: true } },
        },
      });

      const batchNumber = data.batchNumber?.trim() || (data.invoiceNumber?.trim() ? data.invoiceNumber.trim() : `GRN-${Date.now()}`);
      const expiryDate = data.expiry
        ? new Date(data.expiry)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const existingBatch = await tx.batch.findFirst({
        where: {
          branchId,
          productId: data.productId,
          batchNumber,
        },
      });

      let batchId = "";
      if (existingBatch) {
        const newQty = existingBatch.quantityInBaseUnits + baseUnitsReceived;
        await tx.batch.update({
          where: { id: existingBatch.id },
          data: { quantityInBaseUnits: newQty, status: "ACTIVE" },
        });
        batchId = existingBatch.id;
      } else {
        const newBatch = await tx.batch.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId,
            productId: data.productId,
            batchNumber,
            expiryDate,
            quantityInBaseUnits: baseUnitsReceived,
            costPricePerUnit: price / unitsPerPack,
            salePricePerUnit: salePrice / unitsPerPack,
            status: "ACTIVE",
          },
        });
        batchId = newBatch.id;
      }

      const agg = await tx.batch.aggregate({
        where: {
          branchId,
          productId: data.productId,
          status: "ACTIVE",
        },
        _sum: { quantityInBaseUnits: true },
      });

      await tx.stockMovement.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId,
          productId: data.productId,
          batchId,
          movementType: "PURCHASE_RECEIPT",
          quantityDelta: baseUnitsReceived,
          balanceAfter: agg._sum.quantityInBaseUnits ?? baseUnitsReceived,
          unitCost: price / unitsPerPack,
          referenceNumber: data.invoiceNumber ?? null,
        },
      });

      await tx.product.update({
        where: { id: data.productId },
        data: {
          stockQty: { increment: data.quantity },
          expiry: data.expiry ?? undefined,
        },
      });

      emitEvent("stock:updated", stockPurchase);
      return stockPurchase;
    });
  },

  async update(scope: BranchScope, id: string, data: Partial<CreateStockInput & { quantity: number }>) {
    const old = await prisma.stockPurchase.findFirst({ where: { id, ...branchWhere(scope) } });
    if (!old) throw new NotFoundError("Stock purchase");

    const qtyDiff = (data.quantity ?? old.quantity) - old.quantity;
    const totalValue = (data.quantity ?? old.quantity) * old.purchasePrice;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.stockPurchase.update({
        where: { id },
        data: {
          quantity: data.quantity ?? old.quantity,
          expiry: data.expiry ?? old.expiry,
          totalValue,
          companyId: data.companyId ?? old.companyId,
          invoiceNumber: data.invoiceNumber ?? old.invoiceNumber,
          distributorId: data.distributorId ?? old.distributorId,
        },
        include: {
          product: { select: { name: true } },
          distributor: { select: { name: true } },
          company: { select: { name: true } },
        },
      });

      await tx.product.update({
        where: { id: old.productId },
        data: {
          stockQty: { increment: qtyDiff },
          expiry: data.expiry ?? undefined,
        },
      });

      return updated;
    });
  },

  async remove(scope: BranchScope, id: string) {
    const old = await prisma.stockPurchase.findFirst({ where: { id, ...branchWhere(scope) } });
    if (!old) throw new NotFoundError("Stock purchase");

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.stockPurchase.update({
        where: { id },
        data: { active: 0 },
      });

      await tx.product.update({
        where: { id: old.productId },
        data: { stockQty: { decrement: old.quantity } },
      });

      return { success: true };
    });
  },

  // =========================================================================
  // PILLAR D: DIRECT SUPPLIER INVOICES & ATOMIC RECEIVING
  // =========================================================================
  async createInvoice(scope: BranchScope, data: CreatePurchaseInvoiceInput, receivedByUserId?: string) {
    const branchId = await resolveBranchId(scope);

    // Validate distributor exists and belongs to this pharmacy
    const distributor = await prisma.distributor.findFirst({
      where: { id: data.distributorId, pharmacyId: scope.pharmacyId },
    });
    if (!distributor) {
      throw new NotFoundError("Distributor not found");
    }

    const trimmedInvoiceNumber = data.invoiceNumber.trim();

    // Check duplicate invoice number for this distributor
    const existing = await prisma.purchaseInvoice.findUnique({
      where: {
        pharmacyId_distributorId_invoiceNumber: {
          pharmacyId: scope.pharmacyId,
          distributorId: data.distributorId,
          invoiceNumber: trimmedInvoiceNumber,
        },
      },
    });
    if (existing) {
      throw new BadRequestError(`Invoice #${trimmedInvoiceNumber} already exists for ${distributor.name}`);
    }

    // Pre-calculate line totals and invoice totals
    let calculatedSubtotal = 0;
    for (const item of data.items) {
      calculatedSubtotal += item.quantityPacks * item.unitCost;
    }

    const discount = data.discount ?? 0;
    const tax = data.tax ?? 0;
    const totalAmount = Math.max(0, calculatedSubtotal - discount + tax);
    const paidAmount = Math.min(data.paidAmount ?? 0, totalAmount);
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    let status = "UNPAID";
    if (balanceDue === 0 && totalAmount > 0) {
      status = "PAID";
    } else if (paidAmount > 0) {
      status = "PARTIAL";
    }

    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate) : null;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create PurchaseInvoice header
      const invoice = await tx.purchaseInvoice.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId,
          distributorId: data.distributorId,
          invoiceNumber: trimmedInvoiceNumber,
          invoiceDate,
          dueDate,
          subtotal: calculatedSubtotal,
          discount,
          tax,
          totalAmount,
          paidAmount,
          balanceDue,
          status,
          paymentMethod: data.paymentMethod || "CREDIT",
          notes: data.notes || "",
          receivedBy: receivedByUserId ?? null,
        },
      });

      // 2. Process each line item atomically
      for (const item of data.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, pharmacyId: scope.pharmacyId },
          select: { id: true, name: true, unitsPerPack: true },
        });
        if (!product) {
          throw new NotFoundError(`Product ${item.productId}`);
        }

        const unitsPerPack = item.unitsPerPack ?? product.unitsPerPack ?? 1;
        const quantityBaseUnits = item.quantityPacks * unitsPerPack;
        const costPricePerUnit = item.unitCost / unitsPerPack;
        const salePricePerUnit = item.salePrice / unitsPerPack;
        const totalLineCost = item.quantityPacks * item.unitCost;
        const batchNum = item.batchNumber.trim();
        const expiryDate = new Date(item.expiryDate);

        // Provision or top-up batch
        const existingBatch = await tx.batch.findFirst({
          where: {
            branchId,
            productId: item.productId,
            batchNumber: batchNum,
          },
        });

        let batchRecord;
        if (existingBatch) {
          batchRecord = await tx.batch.update({
            where: { id: existingBatch.id },
            data: {
              quantityInBaseUnits: { increment: quantityBaseUnits },
              costPricePerUnit,
              salePricePerUnit,
              expiryDate,
              status: "ACTIVE",
            },
          });
        } else {
          batchRecord = await tx.batch.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId,
              productId: item.productId,
              batchNumber: batchNum,
              expiryDate,
              quantityInBaseUnits: quantityBaseUnits,
              costPricePerUnit,
              salePricePerUnit,
              status: "ACTIVE",
            },
          });
        }

        // Get aggregate balance for stock movement ledger
        const agg = await tx.batch.aggregate({
          where: {
            branchId,
            productId: item.productId,
            status: "ACTIVE",
          },
          _sum: { quantityInBaseUnits: true },
        });
        const balanceAfter = agg._sum.quantityInBaseUnits ?? quantityBaseUnits;

        // Log immutable StockMovement
        await tx.stockMovement.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId,
            productId: item.productId,
            batchId: batchRecord.id,
            movementType: "PURCHASE_RECEIPT",
            quantityDelta: quantityBaseUnits,
            balanceAfter,
            unitCost: costPricePerUnit,
            referenceNumber: trimmedInvoiceNumber,
            reasonCode: "SUPPLIER_INVOICE",
            createdById: receivedByUserId ?? null,
          },
        });

        // Create PurchaseInvoiceItem
        await tx.purchaseInvoiceItem.create({
          data: {
            invoiceId: invoice.id,
            productId: item.productId,
            batchId: batchRecord.id,
            batchNumber: batchNum,
            expiryDate,
            quantityPacks: item.quantityPacks,
            unitsPerPack,
            quantityBaseUnits,
            unitCost: item.unitCost,
            salePrice: item.salePrice,
            totalCost: totalLineCost,
          },
        });

        // Update product master pricing & pack stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQty: { increment: item.quantityPacks },
            purchasePrice: item.unitCost,
            salePrice: item.salePrice,
            expiry: item.expiryDate,
          },
        });

        // Legacy StockPurchase sync
        await tx.stockPurchase.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId,
            productId: item.productId,
            distributorId: data.distributorId,
            companyId: distributor.companyId,
            invoiceNumber: trimmedInvoiceNumber,
            quantity: item.quantityPacks,
            purchasePrice: item.unitCost,
            salePrice: item.salePrice,
            expiry: item.expiryDate,
            totalValue: totalLineCost,
          },
        });
      }

      // 3. Record initial payment if provided
      if (paidAmount > 0) {
        await tx.distributorPayment.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId,
            distributorId: data.distributorId,
            invoiceId: invoice.id,
            amount: paidAmount,
            paymentMethod: data.paymentMethod === "CREDIT" ? "CASH" : (data.paymentMethod || "CASH"),
            referenceNumber: trimmedInvoiceNumber,
            paidAt: invoiceDate,
            notes: "Initial payment upon invoice entry",
          },
        });
      }

      // 4. Fetch full invoice with relations
      const fullInvoice = await tx.purchaseInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          distributor: { select: { id: true, name: true, phone: true, contact: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, barcode: true } },
              batch: true,
            },
          },
          payments: true,
        },
      });

      emitEvent("purchase:invoice_created", fullInvoice);
      emitEvent("stock:updated", { distributorId: data.distributorId, invoiceNumber: trimmedInvoiceNumber });
      return normalizePurchaseInvoice(fullInvoice);
    });
  },

  async listInvoices(scope: BranchScope, query: ListInvoicesQuery = {}) {
    const where: Prisma.PurchaseInvoiceWhereInput = {
      pharmacyId: scope.pharmacyId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...(query.distributorId ? { distributorId: query.distributorId } : {}),
      ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
    };

    if (query.dateFrom || query.dateTo) {
      where.invoiceDate = {};
      if (query.dateFrom) where.invoiceDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.invoiceDate.lte = new Date(query.dateTo);
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: s, mode: "insensitive" } },
        { distributor: { name: { contains: s, mode: "insensitive" } } },
      ];
    }

    const invoices = await prisma.purchaseInvoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      include: {
        distributor: { select: { id: true, name: true, phone: true, contact: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true } },
          },
        },
        payments: true,
      },
    });

    return normalizePurchaseInvoiceList(invoices);
  },

  async getInvoiceById(scope: BranchScope, id: string) {
    const invoice = await prisma.purchaseInvoice.findFirst({
      where: {
        id,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      include: {
        distributor: { select: { id: true, name: true, phone: true, contact: true, address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true, genericName: true } },
            batch: true,
          },
        },
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!invoice) throw new NotFoundError("Purchase invoice");
    return normalizePurchaseInvoice(invoice);
  },

  // =========================================================================
  // SUPPLIER LEDGER & ACCOUNTS PAYABLE
  // =========================================================================
  async recordPayment(scope: BranchScope, distributorId: string, data: RecordSupplierPaymentInput) {
    const branchId = await resolveBranchId(scope);
    const distributor = await prisma.distributor.findFirst({
      where: { id: distributorId, pharmacyId: scope.pharmacyId },
    });
    if (!distributor) throw new NotFoundError("Distributor");

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let updatedInvoice = null;

      if (data.invoiceId) {
        const invoice = await tx.purchaseInvoice.findFirst({
          where: { id: data.invoiceId, distributorId, pharmacyId: scope.pharmacyId },
        });
        if (!invoice) throw new NotFoundError("Purchase invoice");

        const curPaid = Number(invoice.paidAmount);
        const total = Number(invoice.totalAmount);
        const newPaid = Math.min(total, curPaid + data.amount);
        const newBalance = Math.max(0, total - newPaid);
        const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

        updatedInvoice = await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            balanceDue: newBalance,
            status: newStatus,
          },
        });
      }

      const payment = await tx.distributorPayment.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId,
          distributorId,
          invoiceId: data.invoiceId ?? null,
          amount: data.amount,
          paymentMethod: data.paymentMethod || "CASH",
          referenceNumber: data.referenceNumber || "",
          paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
          notes: data.notes || "",
        },
        include: {
          distributor: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      emitEvent("distributor:payment_recorded", payment);
      return {
        payment: {
          ...payment,
          amount: Number(payment.amount),
        },
        invoice: updatedInvoice ? normalizePurchaseInvoice(updatedInvoice) : null,
      };
    });
  },

  async getDistributorLedger(scope: BranchScope, distributorId: string) {
    const distributor = await prisma.distributor.findFirst({
      where: { id: distributorId, pharmacyId: scope.pharmacyId },
      include: { company: { select: { name: true } } },
    });
    if (!distributor) throw new NotFoundError("Distributor");

    const invoices = await prisma.purchaseInvoice.findMany({
      where: { pharmacyId: scope.pharmacyId, distributorId },
      orderBy: { invoiceDate: "asc" },
      include: {
        items: {
          include: { product: { select: { name: true } } },
        },
      },
    });

    const payments = await prisma.distributorPayment.findMany({
      where: { pharmacyId: scope.pharmacyId, distributorId },
      orderBy: { paidAt: "asc" },
      include: {
        invoice: { select: { invoiceNumber: true } },
      },
    });

    // Build chronological transaction timeline
    type LedgerEvent = {
      id: string;
      date: string;
      type: "INVOICE" | "PAYMENT";
      refNumber: string;
      description: string;
      debit: number;   // Invoiced (Increases liability / debt owed)
      credit: number;  // Paid (Reduces liability)
      runningBalance: number;
      status?: string;
      paymentMethod?: string;
    };

    const events: Omit<LedgerEvent, "runningBalance">[] = [];

    for (const inv of invoices) {
      events.push({
        id: inv.id,
        date: inv.invoiceDate.toISOString(),
        type: "INVOICE",
        refNumber: inv.invoiceNumber,
        description: `Purchase Invoice #${inv.invoiceNumber} (${inv.items.length} items)`,
        debit: Number(inv.totalAmount),
        credit: 0,
        status: inv.status,
      });
    }

    for (const pay of payments) {
      const invRef = pay.invoice?.invoiceNumber ? ` (Inv #${pay.invoice.invoiceNumber})` : "";
      events.push({
        id: pay.id,
        date: pay.paidAt.toISOString(),
        type: "PAYMENT",
        refNumber: pay.referenceNumber || "Payment",
        description: `Payment${invRef} - ${pay.paymentMethod}${pay.notes ? ` (${pay.notes})` : ""}`,
        debit: 0,
        credit: Number(pay.amount),
        paymentMethod: pay.paymentMethod,
      });
    }

    // Sort ascending by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const statement: LedgerEvent[] = events.map((ev) => {
      running += ev.debit - ev.credit;
      return {
        ...ev,
        runningBalance: Number(running.toFixed(4)),
      };
    });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstandingBalance = Number((totalInvoiced - totalPaid).toFixed(4));
    const unpaidInvoicesCount = invoices.filter((i) => i.status !== "PAID" && i.status !== "VOID").length;

    return {
      distributor: {
        id: distributor.id,
        name: distributor.name,
        phone: distributor.phone,
        contact: distributor.contact,
        address: distributor.address,
        companyName: distributor.company?.name ?? null,
      },
      summary: {
        totalInvoiced: Number(totalInvoiced.toFixed(4)),
        totalPaid: Number(totalPaid.toFixed(4)),
        outstandingBalance,
        totalInvoicesCount: invoices.length,
        unpaidInvoicesCount,
      },
      statement: statement.reverse(), // most recent first for statement view
      invoices: normalizePurchaseInvoiceList(invoices),
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber,
        paidAt: p.paidAt.toISOString(),
        notes: p.notes,
        invoiceNumber: p.invoice?.invoiceNumber ?? null,
      })),
    };
  },

  async getSuppliersLedgerSummary(scope: BranchScope) {
    const distributors = await prisma.distributor.findMany({
      where: { pharmacyId: scope.pharmacyId },
      orderBy: { name: "asc" },
      include: {
        company: { select: { name: true } },
        purchaseInvoices: {
          select: { totalAmount: true, paidAmount: true, balanceDue: true, status: true },
        },
        distributorPayments: {
          select: { amount: true },
        },
      },
    });

    let overallInvoiced = 0;
    let overallPaid = 0;

    const distributorSummaries = distributors.map((d) => {
      const totalInvoiced = d.purchaseInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
      const totalPaid = d.distributorPayments.reduce((s, p) => s + Number(p.amount), 0);
      const balanceDue = Math.max(0, totalInvoiced - totalPaid);
      const unpaidInvoices = d.purchaseInvoices.filter((i) => i.status !== "PAID" && i.status !== "VOID").length;

      overallInvoiced += totalInvoiced;
      overallPaid += totalPaid;

      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        contact: d.contact,
        companyName: d.company?.name ?? null,
        invoiceCount: d.purchaseInvoices.length,
        unpaidInvoices,
        totalInvoiced: Number(totalInvoiced.toFixed(4)),
        totalPaid: Number(totalPaid.toFixed(4)),
        balanceDue: Number(balanceDue.toFixed(4)),
      };
    });

    const totalOutstanding = Math.max(0, overallInvoiced - overallPaid);

    return {
      summary: {
        totalInvoiced: Number(overallInvoiced.toFixed(4)),
        totalPaid: Number(overallPaid.toFixed(4)),
        outstandingBalance: Number(totalOutstanding.toFixed(4)),
        supplierCount: distributors.length,
        suppliersWithBalance: distributorSummaries.filter((s) => s.balanceDue > 0).length,
      },
      distributors: distributorSummaries,
    };
  },
};
