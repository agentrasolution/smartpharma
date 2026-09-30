import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    sale: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    saleItem: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    arrear: {
      aggregate: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
    batch: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
    },
    returnEntry: {
      findMany: vi.fn(),
    },
    expense: {
      findMany: vi.fn(),
    },
    purchaseInvoice: {
      aggregate: vi.fn(),
    },
  };
  return { prismaMock };
});

vi.mock("../src/services/prisma", () => ({ prisma: prismaMock }));

import { reportsService } from "../src/modules/reports/reports.service";

describe("reportsService (Pillar I: Costing and Reports)", () => {
  const scope = {
    pharmacyId: "pharmacy-1",
    branchId: "branch-1",
    userRole: "ADMIN",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStats", () => {
    it("aggregates revenue, COGS, gross profit, arrears, and low stock", async () => {
      prismaMock.sale.aggregate
        .mockResolvedValueOnce({
          _sum: { total: 1000, totalCogs: 600, grossProfit: 400 },
          _count: { id: 5 },
        }) // today
        .mockResolvedValueOnce({
          _sum: { total: 25000, totalCogs: 15000, grossProfit: 10000 },
        }); // month

      prismaMock.arrear.aggregate.mockResolvedValueOnce({
        _sum: { balanceDue: 1200 },
      });

      prismaMock.product.count.mockResolvedValueOnce(3);
      prismaMock.batch.count.mockResolvedValueOnce(2);

      prismaMock.sale.groupBy.mockResolvedValueOnce([
        { createdAt: new Date("2026-09-28"), _sum: { total: 500 } },
        { createdAt: new Date("2026-09-29"), _sum: { total: 500 } },
      ]);

      prismaMock.saleItem.groupBy.mockResolvedValueOnce([
        {
          productName: "Panadol Extra",
          _sum: { quantity: 50, subtotal: 500, cogs: 300 },
        },
      ]);

      const stats = await reportsService.getStats(scope);

      expect(stats.todayRevenue).toBe(1000);
      expect(stats.todayCogs).toBe(600);
      expect(stats.todayProfit).toBe(400);
      expect(stats.todaySalesCount).toBe(5);
      expect(stats.monthRevenue).toBe(25000);
      expect(stats.monthCogs).toBe(15000);
      expect(stats.monthProfit).toBe(10000);
      expect(stats.monthGrossMarginPercent).toBe(40);
      expect(stats.totalArrears).toBe(1200);
      expect(stats.lowStockCount).toBe(3);
      expect(stats.expiringSoonCount).toBe(2);
      expect(stats.topProducts).toHaveLength(1);
      expect(stats.topProducts[0].name).toBe("Panadol Extra");
      expect(stats.topProducts[0].profit).toBe(200);
    });
  });

  describe("getMarginReport", () => {
    it("groups profitability by drug", async () => {
      prismaMock.saleItem.findMany.mockResolvedValueOnce([
        {
          productId: "prod-1",
          productName: "Augmentin 1g",
          barcode: "1234567890123",
          quantity: 2,
          subtotal: 60,
          unitCost: 18,
          cogs: 36,
          product: { category: "Antibiotics", distributor: { id: "dist-1", name: "PharmaCorp" } },
          sale: { branchId: "branch-1", branch: { name: "Main Branch" } },
        },
        {
          productId: "prod-1",
          productName: "Augmentin 1g",
          barcode: "1234567890123",
          quantity: 1,
          subtotal: 30,
          unitCost: 18,
          cogs: 18,
          product: { category: "Antibiotics", distributor: { id: "dist-1", name: "PharmaCorp" } },
          sale: { branchId: "branch-1", branch: { name: "Main Branch" } },
        },
      ]);

      const report = await reportsService.getMarginReport(scope, { groupBy: "drug" });

      expect(report.groupBy).toBe("drug");
      expect(report.totalQuantity).toBe(3);
      expect(report.totalRevenue).toBe(90);
      expect(report.totalCogs).toBe(54);
      expect(report.totalGrossProfit).toBe(36);
      expect(report.overallMarginPercent).toBe(40);
      expect(report.items).toHaveLength(1);
      expect(report.items[0].label).toBe("Augmentin 1g");
      expect(report.items[0].grossProfit).toBe(36);
      expect(report.items[0].marginPercent).toBe(40);
    });

    it("groups profitability by category and supplier", async () => {
      prismaMock.saleItem.findMany.mockResolvedValueOnce([
        {
          productId: "prod-1",
          productName: "Augmentin 1g",
          barcode: "1234567890123",
          quantity: 2,
          subtotal: 100,
          unitCost: 30,
          cogs: 60,
          product: { category: "Antibiotics", distributor: { id: "dist-1", name: "PharmaCorp" } },
          sale: { branchId: "branch-1", branch: { name: "Main Branch" } },
        },
      ]);

      const catReport = await reportsService.getMarginReport(scope, { groupBy: "category" });
      expect(catReport.groupBy).toBe("category");
      expect(catReport.items[0].label).toBe("Antibiotics");
      expect(catReport.items[0].marginPercent).toBe(40);

      prismaMock.saleItem.findMany.mockResolvedValueOnce([
        {
          productId: "prod-1",
          productName: "Augmentin 1g",
          barcode: "1234567890123",
          quantity: 2,
          subtotal: 100,
          unitCost: 30,
          cogs: 60,
          product: { category: "Antibiotics", distributor: { id: "dist-1", name: "PharmaCorp" } },
          sale: { branchId: "branch-1", branch: { name: "Main Branch" } },
        },
      ]);

      const supReport = await reportsService.getMarginReport(scope, { groupBy: "supplier" });
      expect(supReport.groupBy).toBe("supplier");
      expect(supReport.items[0].label).toBe("PharmaCorp");
    });
  });

  describe("getLossReport", () => {
    it("calculates adjustment shrinkage, expired discards, and customer refunds", async () => {
      prismaMock.stockMovement.findMany
        .mockResolvedValueOnce([
          {
            id: "mov-adj-1",
            productId: "prod-1",
            quantityDelta: -5,
            unitCost: 10,
            reasonCode: "DAMAGED_IN_TRANSIT",
            createdAt: new Date("2026-09-20"),
            product: { name: "Panadol", barcode: "111", category: "Analgesics" },
            batch: { batchNumber: "B100", expiryDate: new Date("2027-01-01") },
          },
        ]) // adjustments
        .mockResolvedValueOnce([
          {
            id: "mov-exp-1",
            quantityDelta: -2,
            unitCost: 15,
            movementType: "EXPIRED_DISCARD",
            createdAt: new Date("2026-09-21"),
            product: { name: "Eye Drops", barcode: "222" },
            batch: { batchNumber: "B200", expiryDate: new Date("2026-09-10") },
          },
        ]); // expired

      prismaMock.returnEntry.findMany.mockResolvedValueOnce([
        {
          id: "ret-1",
          refundAmount: 25,
          items: [],
        },
      ]);

      const loss = await reportsService.getLossReport(scope, {});

      expect(loss.summary.adjustmentLoss).toBe(50);
      expect(loss.summary.expiryLoss).toBe(30);
      expect(loss.summary.customerRefunds).toBe(25);
      expect(loss.summary.totalLoss).toBe(105);
      expect(loss.adjustmentLosses).toHaveLength(1);
      expect(loss.expiredDiscards).toHaveLength(1);
      expect(loss.returnsCount).toBe(1);
    });
  });

  describe("getStockValuation", () => {
    it("computes cost valuation and retail valuation across categories and branches", async () => {
      prismaMock.batch.findMany.mockResolvedValueOnce([
        {
          id: "batch-1",
          branchId: "branch-1",
          quantityInBaseUnits: 100,
          costPricePerUnit: 10,
          salePricePerUnit: 15,
          product: {
            id: "prod-1",
            name: "Paracetamol",
            barcode: "1001",
            category: "Pain Relief",
            purchasePrice: 10,
            salePrice: 15,
          },
          branch: { id: "branch-1", name: "Branch 1" },
        },
        {
          id: "batch-2",
          branchId: "branch-1",
          quantityInBaseUnits: 50,
          costPricePerUnit: 20,
          salePricePerUnit: 30,
          product: {
            id: "prod-2",
            name: "Amoxicillin",
            barcode: "1002",
            category: "Antibiotics",
            purchasePrice: 20,
            salePrice: 30,
          },
          branch: { id: "branch-1", name: "Branch 1" },
        },
      ]);

      const valuation = await reportsService.getStockValuation(scope);

      // Cost: 100*10 + 50*20 = 1000 + 1000 = 2000
      // Retail: 100*15 + 50*30 = 1500 + 1500 = 3000
      // Potential Gross Profit: 1000
      // Margin: 1000 / 3000 = 33.3%
      expect(valuation.summary.totalUnits).toBe(150);
      expect(valuation.summary.totalCostValuation).toBe(2000);
      expect(valuation.summary.totalRetailValuation).toBe(3000);
      expect(valuation.summary.potentialGrossProfit).toBe(1000);
      expect(valuation.summary.potentialMarginPercent).toBe(33.3);
      expect(valuation.byCategory).toHaveLength(2);
      expect(valuation.byBranch).toHaveLength(1);
    });
  });

  describe("getProfitAndLoss", () => {
    it("calculates P&L including revenue, COGS, operating expenses, and VAT balance", async () => {
      prismaMock.sale.aggregate.mockResolvedValueOnce({
        _sum: {
          subtotal: 10000,
          discount: 500,
          total: 10450,
          totalCogs: 5000,
          totalVat: 950,
          grossProfit: 3550,
        },
        _count: { id: 25 },
      });

      prismaMock.expense.findMany.mockResolvedValueOnce([
        { id: "exp-1", category: "Rent", amount: 1500, date: "2026-09-15" },
        { id: "exp-2", category: "Utilities", amount: 500, date: "2026-09-16" },
      ]);

      prismaMock.purchaseInvoice.aggregate.mockResolvedValueOnce({
        _sum: {
          totalAmount: 6000,
          tax: 600,
        },
      });

      const pnl = await reportsService.getProfitAndLoss(scope, {});

      // Net sales: max(0, 10000 - 500 - 950) = 8550
      // Gross profit: 8550 - 5000 = 3550
      // Operating expenses: 1500 + 500 = 2000
      // Net operating profit: 3550 - 2000 = 1550
      // Margin: 1550 / 8550 = 18.1%
      // Net VAT payable: 950 (collected) - 600 (input tax) = 350
      expect(pnl.salesRevenue.grossSales).toBe(10000);
      expect(pnl.salesRevenue.discounts).toBe(500);
      expect(pnl.salesRevenue.vatCollected).toBe(950);
      expect(pnl.salesRevenue.netSales).toBe(8550);
      expect(pnl.costOfGoodsSold.totalCogs).toBe(5000);
      expect(pnl.costOfGoodsSold.grossProfit).toBe(3550);
      expect(pnl.operatingExpenses.total).toBe(2000);
      expect(pnl.operatingExpenses.byCategory).toHaveLength(2);
      expect(pnl.netProfit.netOperatingProfit).toBe(1550);
      expect(pnl.netProfit.netProfitMarginPercent).toBe(18.1);
      expect(pnl.taxAndVat.vatCollectedOnSales).toBe(950);
      expect(pnl.taxAndVat.vatPaidOnPurchases).toBe(600);
      expect(pnl.taxAndVat.netVatPayable).toBe(350);
    });
  });

  describe("exportReport", () => {
    it("generates CSV for margin reports", async () => {
      prismaMock.saleItem.findMany.mockResolvedValueOnce([
        {
          productId: "prod-1",
          productName: "Paracetamol",
          barcode: "1001",
          quantity: 10,
          subtotal: 100,
          unitCost: 6,
          cogs: 60,
          product: { category: "Analgesics", distributor: null },
          sale: { branchId: "branch-1", branch: { name: "Branch 1" } },
        },
      ]);

      const exported = await reportsService.exportReport(scope, {
        type: "margin",
        groupBy: "drug",
        format: "csv",
      });

      expect(exported.contentType).toBe("text/csv");
      expect(exported.filename).toContain("margin-report-drug");
      expect(exported.data).toContain("Group Label,Reference / Barcode");
      expect(exported.data).toContain('"Paracetamol"');
    });

    it("generates CSV for P&L statements", async () => {
      prismaMock.sale.aggregate.mockResolvedValueOnce({
        _sum: {
          subtotal: 1000,
          discount: 0,
          total: 1000,
          totalCogs: 600,
          totalVat: 50,
          grossProfit: 350,
        },
        _count: { id: 1 },
      });

      prismaMock.expense.findMany.mockResolvedValueOnce([]);
      prismaMock.purchaseInvoice.aggregate.mockResolvedValueOnce({
        _sum: { totalAmount: 0, tax: 0 },
      });

      const exported = await reportsService.exportReport(scope, {
        type: "pnl",
        format: "csv",
      });

      expect(exported.contentType).toBe("text/csv");
      expect(exported.filename).toContain("pnl-statement");
      expect(exported.data).toContain("Category,Metric,Amount");
      expect(exported.data).toContain("Revenue,Gross Sales,1000");
    });

    it("generates CSV for sales COGS ledger", async () => {
      prismaMock.sale.findMany.mockResolvedValueOnce([
        {
          id: "sale-101",
          createdAt: new Date("2026-09-30T10:00:00Z"),
          paymentMethod: "CASH",
          branch: { name: "Branch 1" },
          items: [
            {
              productName: "Cough Syrup",
              barcode: "555",
              batchNumber: "B555",
              quantity: 1,
              unitPrice: 20,
              unitCost: 12,
              subtotal: 20,
              cogs: 12,
              vatRate: 15,
              vatAmount: 2.61,
            },
          ],
        },
      ]);

      const exported = await reportsService.exportReport(scope, {
        type: "sales_cogs",
        format: "csv",
      });

      expect(exported.contentType).toBe("text/csv");
      expect(exported.filename).toContain("sales-cogs-ledger");
      expect(exported.data).toContain("Invoice / Sale ID,Date,Branch");
      expect(exported.data).toContain('"sale-101"');
      expect(exported.data).toContain('"Cough Syrup"');
    });
  });
});
