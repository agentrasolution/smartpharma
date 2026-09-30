import { prisma } from "../../services/prisma";
import type { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";
import type {
  ReportDateRangeQuery,
  MarginReportQuery,
  ExportReportQuery,
} from "./reports.schema";

function branchSaleWhere(scope: BranchScope, branchId?: string): Prisma.SaleWhereInput {
  const targetBranch = branchId || scope.branchId;
  return {
    pharmacyId: scope.pharmacyId,
    ...(targetBranch ? { branchId: targetBranch } : {}),
  };
}

function parseDateRange(query: ReportDateRangeQuery) {
  const where: { gte?: Date; lte?: Date } = {};
  if (query.startDate) {
    const d = new Date(query.startDate);
    if (!isNaN(d.getTime())) where.gte = d;
  }
  if (query.endDate) {
    const d = new Date(query.endDate);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      where.lte = d;
    }
  }
  return where.gte || where.lte ? where : undefined;
}

export const reportsService = {
  // -------------------------------------------------------------
  // 1. DASHBOARD OVERVIEW STATS (Enhanced with COGS & Gross Profit)
  // -------------------------------------------------------------
  async getStats(scope: BranchScope) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const scopedSale = (extra: Prisma.SaleWhereInput = {}): Prisma.SaleWhereInput => ({
      ...branchSaleWhere(scope),
      ...extra,
    });

    const arrearWhere: Prisma.ArrearWhereInput = {
      status: "pending",
      pharmacyId: scope.pharmacyId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
    };

    const productWhere: Prisma.ProductWhereInput = {
      stockQty: { lte: 5 },
      pharmacyId: scope.pharmacyId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
    };

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringSoonCountPromise = prisma.batch.count({
      where: {
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        currentQty: { gt: 0 },
        expiryDate: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
      },
    });

    const [todayAgg, monthAgg, totalArrears, lowStockCount, expiringSoonCount, weekRevenue, topProducts] =
      await Promise.all([
        prisma.sale.aggregate({
          where: scopedSale({ createdAt: { gte: today } }),
          _sum: { total: true, totalCogs: true, grossProfit: true },
          _count: { id: true },
        }),
        prisma.sale.aggregate({
          where: scopedSale({ createdAt: { gte: thirtyDaysAgo } }),
          _sum: { total: true, totalCogs: true, grossProfit: true },
        }),
        prisma.arrear.aggregate({
          where: arrearWhere,
          _sum: { balanceDue: true },
        }),
        prisma.product.count({
          where: productWhere,
        }),
        expiringSoonCountPromise,
        prisma.sale.groupBy({
          by: ["createdAt"],
          where: scopedSale({ createdAt: { gte: sevenDaysAgo } }),
          _sum: { total: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.saleItem.groupBy({
          by: ["productName"],
          where: { sale: scopedSale() },
          _sum: { quantity: true, subtotal: true, cogs: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        }),
      ]);

    const todayRev = todayAgg._sum.total ?? 0;
    const todayCogs = todayAgg._sum.totalCogs ?? 0;
    const todayProfit = todayAgg._sum.grossProfit ?? (todayRev - todayCogs);
    const monthRev = monthAgg._sum.total ?? 0;
    const monthCogs = monthAgg._sum.totalCogs ?? 0;
    const monthProfit = monthAgg._sum.grossProfit ?? (monthRev - monthCogs);

    return {
      todayRevenue: todayRev,
      todayCogs,
      todayProfit,
      todaySalesCount: todayAgg._count.id,
      monthRevenue: monthRev,
      monthCogs,
      monthProfit,
      monthGrossMarginPercent: monthRev > 0 ? Math.round((monthProfit / monthRev) * 1000) / 10 : 0,
      totalArrears: totalArrears._sum.balanceDue ?? 0,
      lowStockCount,
      expiringSoonCount,
      weekRevenue: weekRevenue.map((r: Record<string, unknown>) => ({
        day: (r.createdAt as Date).toISOString().split("T")[0]!,
        revenue: (r._sum as Record<string, number>).total ?? 0,
      })),
      topProducts: topProducts.map((p: any) => ({
        name: p.productName as string,
        value: p._sum.quantity ?? 0,
        revenue: p._sum.subtotal ?? 0,
        cogs: p._sum.cogs ?? 0,
        profit: (p._sum.subtotal ?? 0) - (p._sum.cogs ?? 0),
      })),
    };
  },

  // -------------------------------------------------------------
  // 2. PROFIT MARGIN REPORT (By Drug, Category, Supplier, Branch)
  // -------------------------------------------------------------
  async getMarginReport(scope: BranchScope, query: MarginReportQuery) {
    const dateRange = parseDateRange(query);
    const saleWhere: Prisma.SaleWhereInput = {
      ...branchSaleWhere(scope, query.branchId),
      ...(dateRange ? { createdAt: dateRange } : {}),
    };

    const groupBy = query.groupBy || "drug";

    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: saleWhere,
      },
      include: {
        sale: {
          select: {
            id: true,
            createdAt: true,
            branchId: true,
            branch: { select: { id: true, name: true } },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            category: true,
            distributorId: true,
            distributor: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Grouping container
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        subLabel?: string;
        quantity: number;
        revenue: number;
        cogs: number;
        grossProfit: number;
        salesCount: number;
      }
    >();

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalQuantity = 0;

    for (const item of saleItems) {
      let groupKey = "";
      let groupLabel = "";
      let subLabel = "";

      if (groupBy === "drug") {
        groupKey = item.productId;
        groupLabel = item.productName;
        subLabel = item.barcode;
      } else if (groupBy === "category") {
        groupKey = item.product?.category || "Uncategorized";
        groupLabel = groupKey;
      } else if (groupBy === "supplier") {
        groupKey = item.product?.distributor?.id || "unknown";
        groupLabel = item.product?.distributor?.name || "Direct / No Supplier Assigned";
      } else if (groupBy === "branch") {
        groupKey = item.sale.branchId;
        groupLabel = item.sale.branch?.name || "Main Branch";
      }

      const existing = map.get(groupKey) || {
        key: groupKey,
        label: groupLabel,
        subLabel,
        quantity: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        salesCount: 0,
      };

      const lineCogs = item.cogs > 0 ? item.cogs : item.unitCost * item.quantity;
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal;
      existing.cogs += lineCogs;
      existing.grossProfit += item.subtotal - lineCogs;
      existing.salesCount += 1;

      totalRevenue += item.subtotal;
      totalCogs += lineCogs;
      totalQuantity += item.quantity;

      map.set(groupKey, existing);
    }

    const items = Array.from(map.values())
      .map((entry) => ({
        ...entry,
        revenue: Math.round(entry.revenue * 100) / 100,
        cogs: Math.round(entry.cogs * 100) / 100,
        grossProfit: Math.round(entry.grossProfit * 100) / 100,
        marginPercent:
          entry.revenue > 0
            ? Math.round((entry.grossProfit / entry.revenue) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalGrossProfit = totalRevenue - totalCogs;
    const overallMarginPercent =
      totalRevenue > 0
        ? Math.round((totalGrossProfit / totalRevenue) * 1000) / 10
        : 0;

    return {
      groupBy,
      totalQuantity,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCogs: Math.round(totalCogs * 100) / 100,
      totalGrossProfit: Math.round(totalGrossProfit * 100) / 100,
      overallMarginPercent,
      items,
    };
  },

  // -------------------------------------------------------------
  // 3. LOSS REPORTS (Expiry, Adjustments, Customer Returns)
  // -------------------------------------------------------------
  async getLossReport(scope: BranchScope, query: ReportDateRangeQuery) {
    const dateRange = parseDateRange(query);
    const targetBranch = query.branchId || scope.branchId;

    // A. Inventory Adjustments & Shrinkage (negative quantity delta)
    const adjustments = await prisma.stockMovement.findMany({
      where: {
        pharmacyId: scope.pharmacyId,
        ...(targetBranch ? { branchId: targetBranch } : {}),
        movementType: "ADJUSTMENT",
        quantityDelta: { lt: 0 },
        ...(dateRange ? { createdAt: dateRange } : {}),
      },
      include: {
        product: { select: { name: true, barcode: true, category: true } },
        batch: { select: { batchNumber: true, expiryDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const adjustmentLosses = adjustments.map((adj) => {
      const unitsLost = Math.abs(adj.quantityDelta);
      const unitCost = Number(adj.unitCost);
      const estimatedLoss = Math.round(unitsLost * unitCost * 100) / 100;
      return {
        id: adj.id,
        productId: adj.productId,
        productName: adj.product?.name ?? "Unknown",
        barcode: adj.product?.barcode ?? "",
        batchNumber: adj.batch?.batchNumber ?? "—",
        unitsLost,
        unitCost,
        estimatedLoss,
        reason: adj.reasonCode || "Inventory shrinkage/damaged",
        date: adj.createdAt.toISOString(),
      };
    });

    const totalAdjustmentLoss = adjustmentLosses.reduce((acc, curr) => acc + curr.estimatedLoss, 0);

    // B. Expired Batches / Expiry Discards
    const expiredMovements = await prisma.stockMovement.findMany({
      where: {
        pharmacyId: scope.pharmacyId,
        ...(targetBranch ? { branchId: targetBranch } : {}),
        movementType: { in: ["EXPIRED_DISCARD", "RECALLED_DISCARD"] },
        ...(dateRange ? { createdAt: dateRange } : {}),
      },
      include: {
        product: { select: { name: true, barcode: true } },
        batch: { select: { batchNumber: true, expiryDate: true } },
      },
    });

    const expiredDiscards = expiredMovements.map((exp) => {
      const unitsLost = Math.abs(exp.quantityDelta);
      const unitCost = Number(exp.unitCost);
      const estimatedLoss = Math.round(unitsLost * unitCost * 100) / 100;
      return {
        id: exp.id,
        productName: exp.product?.name ?? "Unknown",
        barcode: exp.product?.barcode ?? "",
        batchNumber: exp.batch?.batchNumber ?? "—",
        unitsLost,
        unitCost,
        estimatedLoss,
        reason: exp.movementType,
        date: exp.createdAt.toISOString(),
      };
    });

    const totalExpiryLoss = expiredDiscards.reduce((acc, curr) => acc + curr.estimatedLoss, 0);

    // C. Customer Returns & Refunds
    const returns = await prisma.returnEntry.findMany({
      where: {
        pharmacyId: scope.pharmacyId,
        ...(targetBranch ? { branchId: targetBranch } : {}),
        ...(dateRange ? { createdAt: dateRange } : {}),
      },
      include: {
        items: true,
      },
    });

    const totalRefunds = returns.reduce((acc, r) => acc + r.refundAmount, 0);

    return {
      summary: {
        totalLoss: Math.round((totalAdjustmentLoss + totalExpiryLoss + totalRefunds) * 100) / 100,
        adjustmentLoss: Math.round(totalAdjustmentLoss * 100) / 100,
        expiryLoss: Math.round(totalExpiryLoss * 100) / 100,
        customerRefunds: Math.round(totalRefunds * 100) / 100,
      },
      adjustmentLosses,
      expiredDiscards,
      returnsCount: returns.length,
    };
  },

  // -------------------------------------------------------------
  // 4. STOCK VALUATION (Batch-Level Cost & Retail Value)
  // -------------------------------------------------------------
  async getStockValuation(scope: BranchScope) {
    const targetBranch = scope.branchId;

    const batches = await prisma.batch.findMany({
      where: {
        pharmacyId: scope.pharmacyId,
        ...(targetBranch ? { branchId: targetBranch } : {}),
        status: "ACTIVE",
        quantityInBaseUnits: { gt: 0 },
      },
      include: {
        product: { select: { id: true, name: true, barcode: true, category: true, purchasePrice: true, salePrice: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    let totalUnits = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;

    const byCategory = new Map<string, { category: string; units: number; costValue: number; retailValue: number }>();
    const byBranch = new Map<string, { branchId: string; branchName: string; units: number; costValue: number; retailValue: number }>();

    for (const b of batches) {
      const units = b.quantityInBaseUnits;
      const unitCost = Number(b.costPricePerUnit) || b.product.purchasePrice || 0;
      const unitSale = Number(b.salePricePerUnit) || b.product.salePrice || 0;

      const costVal = units * unitCost;
      const retailVal = units * unitSale;

      totalUnits += units;
      totalCostValuation += costVal;
      totalRetailValuation += retailVal;

      // Category aggregation
      const catKey = b.product.category || "Uncategorized";
      const catEntry = byCategory.get(catKey) || { category: catKey, units: 0, costValue: 0, retailValue: 0 };
      catEntry.units += units;
      catEntry.costValue += costVal;
      catEntry.retailValue += retailVal;
      byCategory.set(catKey, catEntry);

      // Branch aggregation
      const brKey = b.branchId;
      const brName = b.branch.name;
      const brEntry = byBranch.get(brKey) || { branchId: brKey, branchName: brName, units: 0, costValue: 0, retailValue: 0 };
      brEntry.units += units;
      brEntry.costValue += costVal;
      brEntry.retailValue += retailVal;
      byBranch.set(brKey, brEntry);
    }

    const potentialGrossProfit = totalRetailValuation - totalCostValuation;
    const potentialMarginPercent =
      totalRetailValuation > 0
        ? Math.round((potentialGrossProfit / totalRetailValuation) * 1000) / 10
        : 0;

    return {
      summary: {
        totalActiveBatches: batches.length,
        totalUnits,
        totalCostValuation: Math.round(totalCostValuation * 100) / 100,
        totalRetailValuation: Math.round(totalRetailValuation * 100) / 100,
        potentialGrossProfit: Math.round(potentialGrossProfit * 100) / 100,
        potentialMarginPercent,
      },
      byCategory: Array.from(byCategory.values()).map((c) => ({
        ...c,
        costValue: Math.round(c.costValue * 100) / 100,
        retailValue: Math.round(c.retailValue * 100) / 100,
      })),
      byBranch: Array.from(byBranch.values()).map((br) => ({
        ...br,
        costValue: Math.round(br.costValue * 100) / 100,
        retailValue: Math.round(br.retailValue * 100) / 100,
      })),
    };
  },

  // -------------------------------------------------------------
  // 5. PROFIT AND LOSS STATEMENT (P&L) WITH CONFIGURABLE VAT
  // -------------------------------------------------------------
  async getProfitAndLoss(scope: BranchScope, query: ReportDateRangeQuery) {
    const dateRange = parseDateRange(query);
    const saleWhere: Prisma.SaleWhereInput = {
      ...branchSaleWhere(scope, query.branchId),
      ...(dateRange ? { createdAt: dateRange } : {}),
    };

    const targetBranch = query.branchId || scope.branchId;

    // 1. Sales, COGS & VAT Aggregation
    const salesAgg = await prisma.sale.aggregate({
      where: saleWhere,
      _sum: {
        subtotal: true,
        discount: true,
        total: true,
        totalCogs: true,
        totalVat: true,
        grossProfit: true,
      },
      _count: { id: true },
    });

    const grossSalesRevenue = salesAgg._sum.subtotal ?? 0;
    const discounts = salesAgg._sum.discount ?? 0;
    const totalCollectedVat = salesAgg._sum.totalVat ?? 0;
    const totalCogs = salesAgg._sum.totalCogs ?? 0;

    // Net sales revenue (excluding VAT and after discount)
    const netSalesRevenue = Math.max(0, grossSalesRevenue - discounts - totalCollectedVat);
    const grossProfit = Math.round((netSalesRevenue - totalCogs) * 100) / 100;
    const grossMarginPercent =
      netSalesRevenue > 0
        ? Math.round((grossProfit / netSalesRevenue) * 1000) / 10
        : 0;

    // 2. Operating Expenses
    const expenseWhere: Prisma.ExpenseWhereInput = {
      pharmacyId: scope.pharmacyId,
      ...(targetBranch ? { branchId: targetBranch } : {}),
    };

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
    });

    // Filter by date if date range provided
    const filteredExpenses = expenses.filter((exp) => {
      if (!dateRange) return true;
      const expDate = new Date(exp.date);
      if (isNaN(expDate.getTime())) return true;
      if (dateRange.gte && expDate < dateRange.gte) return false;
      if (dateRange.lte && expDate > dateRange.lte) return false;
      return true;
    });

    const expenseCategoryMap = new Map<string, number>();
    let totalOperatingExpenses = 0;

    for (const exp of filteredExpenses) {
      const cat = exp.category || "General & Administrative";
      const current = expenseCategoryMap.get(cat) || 0;
      expenseCategoryMap.set(cat, current + exp.amount);
      totalOperatingExpenses += exp.amount;
    }

    const operatingExpensesList = Array.from(expenseCategoryMap.entries()).map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
    }));

    // 3. Purchase Invoices & Input VAT
    const purchaseInvoiceWhere: Prisma.PurchaseInvoiceWhereInput = {
      pharmacyId: scope.pharmacyId,
      ...(targetBranch ? { branchId: targetBranch } : {}),
      ...(dateRange ? { invoiceDate: dateRange } : {}),
    };

    const purchaseAgg = await prisma.purchaseInvoice.aggregate({
      where: purchaseInvoiceWhere,
      _sum: {
        totalAmount: true,
        tax: true,
      },
    });

    const totalPurchases = Number(purchaseAgg._sum.totalAmount) || 0;
    const totalInputVatPaid = Number(purchaseAgg._sum.tax) || 0;

    // Net operating profit (EBITDA)
    const netOperatingProfit = Math.round((grossProfit - totalOperatingExpenses) * 100) / 100;
    const netProfitMarginPercent =
      netSalesRevenue > 0
        ? Math.round((netOperatingProfit / netSalesRevenue) * 1000) / 10
        : 0;

    // Net VAT position
    const netVatPayable = Math.round((totalCollectedVat - totalInputVatPaid) * 100) / 100;

    return {
      period: {
        startDate: query.startDate || "Beginning of Records",
        endDate: query.endDate || "Present",
      },
      salesRevenue: {
        grossSales: Math.round(grossSalesRevenue * 100) / 100,
        discounts: Math.round(discounts * 100) / 100,
        vatCollected: Math.round(totalCollectedVat * 100) / 100,
        netSales: Math.round(netSalesRevenue * 100) / 100,
        salesCount: salesAgg._count.id,
      },
      costOfGoodsSold: {
        totalCogs: Math.round(totalCogs * 100) / 100,
        grossProfit,
        grossMarginPercent,
      },
      operatingExpenses: {
        total: Math.round(totalOperatingExpenses * 100) / 100,
        byCategory: operatingExpensesList,
      },
      netProfit: {
        netOperatingProfit,
        netProfitMarginPercent,
      },
      taxAndVat: {
        vatCollectedOnSales: Math.round(totalCollectedVat * 100) / 100,
        vatPaidOnPurchases: Math.round(totalInputVatPaid * 100) / 100,
        netVatPayable,
        totalPurchases: Math.round(totalPurchases * 100) / 100,
      },
    };
  },

  // -------------------------------------------------------------
  // 6. EXPORT REPORTS FOR ACCOUNTANT (CSV / JSON)
  // -------------------------------------------------------------
  async exportReport(scope: BranchScope, query: ExportReportQuery) {
    if (query.type === "margin") {
      const marginData = await this.getMarginReport(scope, query);
      if (query.format === "csv") {
        const headers = ["Group Label", "Reference / Barcode", "Quantity Sold", "Revenue", "COGS", "Gross Profit", "Margin %"];
        const rows = marginData.items.map((i) => [
          `"${i.label.replace(/"/g, '""')}"`,
          `"${(i.subLabel || "").replace(/"/g, '""')}"`,
          i.quantity,
          i.revenue,
          i.cogs,
          i.grossProfit,
          `${i.marginPercent}%`,
        ]);
        return {
          contentType: "text/csv",
          filename: `margin-report-${query.groupBy}-${Date.now()}.csv`,
          data: [headers.join(","), ...rows.map((r) => r.join(","))].join("\n"),
        };
      }
      return { contentType: "application/json", data: marginData };
    }

    if (query.type === "pnl") {
      const pnlData = await this.getProfitAndLoss(scope, query);
      if (query.format === "csv") {
        const lines = [
          "Category,Metric,Amount",
          `Revenue,Gross Sales,${pnlData.salesRevenue.grossSales}`,
          `Revenue,Discounts,${pnlData.salesRevenue.discounts}`,
          `Revenue,Net Sales,${pnlData.salesRevenue.netSales}`,
          `Cost of Goods,Total COGS,${pnlData.costOfGoodsSold.totalCogs}`,
          `Profit,Gross Profit,${pnlData.costOfGoodsSold.grossProfit}`,
          `Profit,Gross Margin %,${pnlData.costOfGoodsSold.grossMarginPercent}%`,
          `Expenses,Total Operating Expenses,${pnlData.operatingExpenses.total}`,
          ...pnlData.operatingExpenses.byCategory.map(
            (e) => `Expenses,"${e.category.replace(/"/g, '""')}",${e.amount}`
          ),
          `Profit,Net Operating Profit,${pnlData.netProfit.netOperatingProfit}`,
          `Tax,VAT Collected on Sales,${pnlData.taxAndVat.vatCollectedOnSales}`,
          `Tax,VAT Paid on Purchases,${pnlData.taxAndVat.vatPaidOnPurchases}`,
          `Tax,Net VAT Payable,${pnlData.taxAndVat.netVatPayable}`,
        ];
        return {
          contentType: "text/csv",
          filename: `pnl-statement-${Date.now()}.csv`,
          data: lines.join("\n"),
        };
      }
      return { contentType: "application/json", data: pnlData };
    }

    if (query.type === "valuation") {
      const valData = await this.getStockValuation(scope);
      if (query.format === "csv") {
        const lines = [
          "Category,Units,Cost Value,Retail Value,Potential Margin",
          ...valData.byCategory.map(
            (c) => `"${c.category.replace(/"/g, '""')}",${c.units},${c.costValue},${c.retailValue},${c.retailValue - c.costValue}`
          ),
          `TOTAL,${valData.summary.totalUnits},${valData.summary.totalCostValuation},${valData.summary.totalRetailValuation},${valData.summary.potentialGrossProfit}`,
        ];
        return {
          contentType: "text/csv",
          filename: `stock-valuation-${Date.now()}.csv`,
          data: lines.join("\n"),
        };
      }
      return { contentType: "application/json", data: valData };
    }

    // Default: sales_cogs ledger
    const dateRange = parseDateRange(query);
    const saleWhere: Prisma.SaleWhereInput = {
      ...branchSaleWhere(scope, query.branchId),
      ...(dateRange ? { createdAt: dateRange } : {}),
    };

    const sales = await prisma.sale.findMany({
      where: saleWhere,
      include: {
        items: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (query.format === "csv") {
      const headers = [
        "Invoice / Sale ID",
        "Date",
        "Branch",
        "Payment Method",
        "Medicine",
        "Barcode",
        "Batch #",
        "Qty",
        "Unit Price",
        "Unit Cost",
        "Line Revenue",
        "Line COGS",
        "Gross Profit",
        "VAT Rate %",
        "VAT Amount",
      ];

      const rows: string[] = [];
      for (const s of sales) {
        for (const item of s.items) {
          const profit = item.subtotal - item.cogs;
          rows.push([
            `"${s.id}"`,
            `"${s.createdAt.toISOString()}"`,
            `"${s.branch.name.replace(/"/g, '""')}"`,
            `"${s.paymentMethod}"`,
            `"${item.productName.replace(/"/g, '""')}"`,
            `"${item.barcode}"`,
            `"${item.batchNumber || "—"}"`,
            item.quantity,
            item.unitPrice,
            item.unitCost,
            item.subtotal,
            item.cogs,
            Math.round(profit * 100) / 100,
            item.vatRate,
            item.vatAmount,
          ].join(","));
        }
      }

      return {
        contentType: "text/csv",
        filename: `sales-cogs-ledger-${Date.now()}.csv`,
        data: [headers.join(","), ...rows].join("\n"),
      };
    }

    return { contentType: "application/json", data: sales };
  },
};