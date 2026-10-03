import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    branch: {
      findFirst: vi.fn(),
    },
    posShift: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cashDrop: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    sale: {
      findMany: vi.fn(),
    },
    returnEntry: {
      findMany: vi.fn(),
    },
  };
  return { prismaMock };
});

vi.mock("../src/services/prisma", () => ({
  prisma: prismaMock,
}));

import * as shiftsService from "../src/modules/shifts/shifts.service";

describe("Pillar F - POS Shift Management & X/Z Reports Service", () => {
  const mockScope = { pharmacyId: "pharm-1", branchId: "branch-1" };
  const mockUser = { id: "user-1", name: "Ahmed Cashier", username: "ahmed" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("openShift", () => {
    it("successfully opens a shift with initial cash float", async () => {
      prismaMock.branch.findFirst.mockResolvedValue({ id: "branch-1", name: "Main Branch" });
      prismaMock.posShift.findFirst.mockResolvedValue(null); // No existing open shift
      prismaMock.posShift.count.mockResolvedValue(4); // Previous 4 shifts
      prismaMock.posShift.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: "shift-5",
          ...data,
          branch: { id: "branch-1", name: "Main Branch" },
        })
      );

      const shift = await shiftsService.openShift(mockScope, mockUser, {
        openingCash: 250.0,
        notes: "Opening morning shift float",
      });

      expect(shift.shiftNumber).toBe(5);
      expect(shift.status).toBe("OPEN");
      expect(shift.openingCash).toBe(250.0);
      expect(shift.expectedCash).toBe(250.0);
      expect(shift.cashierName).toBe("Ahmed Cashier");
      expect(prismaMock.posShift.create).toHaveBeenCalledOnce();
    });

    it("rejects opening a new shift if the cashier already has an active open shift", async () => {
      prismaMock.branch.findFirst.mockResolvedValue({ id: "branch-1", name: "Main Branch" });
      prismaMock.posShift.findFirst.mockResolvedValue({
        id: "shift-active",
        shiftNumber: 3,
        status: "OPEN",
      });

      await expect(
        shiftsService.openShift(mockScope, mockUser, { openingCash: 100.0 })
      ).rejects.toThrow("already have an active open shift (#3)");
    });
  });

  describe("recordCashDrop", () => {
    it("successfully records a cash drop to safe and updates shift", async () => {
      prismaMock.posShift.findFirst.mockResolvedValue({
        id: "shift-1",
        pharmacyId: "pharm-1",
        branchId: "branch-1",
        status: "OPEN",
        openingCash: 200,
      });

      prismaMock.cashDrop.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "drop-1", ...data, createdAt: new Date() })
      );

      prismaMock.cashDrop.findMany.mockResolvedValue([
        { id: "drop-1", type: "DROP", amount: 500, reason: "Excess cash to safe" },
      ]);

      prismaMock.posShift.update.mockResolvedValue({});

      const drop = await shiftsService.recordCashDrop(mockScope, mockUser, {
        shiftId: "shift-1",
        type: "DROP",
        amount: 500,
        reason: "Excess cash to safe",
      });

      expect(drop.amount).toBe(500);
      expect(drop.type).toBe("DROP");
      expect(prismaMock.posShift.update).toHaveBeenCalledWith({
        where: { id: "shift-1" },
        data: { totalCashDrops: 500 },
      });
    });

    it("rejects cash drop on a closed shift", async () => {
      prismaMock.posShift.findFirst.mockResolvedValue({
        id: "shift-closed",
        pharmacyId: "pharm-1",
        status: "CLOSED",
      });

      await expect(
        shiftsService.recordCashDrop(mockScope, mockUser, {
          shiftId: "shift-closed",
          type: "DROP",
          amount: 100,
          reason: "Safe transfer",
        })
      ).rejects.toThrow("Cannot record cash drop on a closed shift");
    });
  });

  describe("getXReport (Mid-Shift Reading)", () => {
    it("calculates accurate live totals for sales, drops, returns, and expected drawer cash", async () => {
      const openedAt = new Date("2026-10-02T08:00:00Z");
      prismaMock.posShift.findFirst.mockResolvedValue({
        id: "shift-1",
        pharmacyId: "pharm-1",
        branchId: "branch-1",
        cashierId: "user-1",
        cashierName: "Ahmed",
        shiftNumber: 1,
        status: "OPEN",
        openingCash: 300,
        openedAt,
        branch: { id: "branch-1", name: "Main Pharmacy Branch" },
        cashDrops: [
          {
            id: "drop-1",
            type: "DROP",
            amount: 400,
            reason: "Midday safe drop",
            createdAt: new Date("2026-10-02T12:00:00Z"),
          },
          {
            id: "drop-2",
            type: "PAYOUT",
            amount: 35,
            reason: "Office milk and water",
            createdAt: new Date("2026-10-02T13:00:00Z"),
          },
        ],
      });

      // Mock sales during shift: 2 cash sales ($150, $200), 1 card sale ($120), 1 split sale ($50 cash, $50 card)
      prismaMock.sale.findMany.mockResolvedValue([
        { id: "S1", total: 150, paymentMethod: "CASH", cashAmount: 150, cardAmount: 0, creditAmount: 0 },
        { id: "S2", total: 200, paymentMethod: "CASH", cashAmount: 200, cardAmount: 0, creditAmount: 0 },
        { id: "S3", total: 120, paymentMethod: "CARD", cashAmount: 0, cardAmount: 120, creditAmount: 0 },
        { id: "S4", total: 100, paymentMethod: "SPLIT", cashAmount: 50, cardAmount: 50, creditAmount: 0 },
      ]);

      // Mock 1 cash refund of $30
      prismaMock.returnEntry.findMany.mockResolvedValue([
        { id: "R1", totalRefund: 30, refundMethod: "CASH" },
      ]);

      const report = await shiftsService.getXReport(mockScope, "shift-1");

      expect(report.shiftNumber).toBe(1);
      expect(report.salesSummary.totalTransactions).toBe(4);
      expect(report.salesSummary.grossSales).toBe(570); // 150 + 200 + 120 + 100
      expect(report.salesSummary.cashSales.amount).toBe(400); // 150 + 200 + 50
      expect(report.salesSummary.cardSales.amount).toBe(170); // 120 + 50

      expect(report.returnsSummary.cashRefunds).toBe(30);
      expect(report.cashMovements.dropsToSafe.total).toBe(400);
      expect(report.cashMovements.payouts.total).toBe(35);

      // Expected Cash in Drawer:
      // Opening (300) + Cash Sales (400) - Cash Refund (30) - Safe Drop (400) - Payout (35) = 235
      expect(report.cashDrawerSummary.expectedCashInDrawer).toBe(235);
    });
  });

  describe("closeShift (Z-Report)", () => {
    it("reconciles exact cash (BALANCED) and closes shift", async () => {
      const openedAt = new Date("2026-10-02T08:00:00Z");
      prismaMock.posShift.findFirst.mockResolvedValue({
        id: "shift-1",
        pharmacyId: "pharm-1",
        branchId: "branch-1",
        cashierId: "user-1",
        cashierName: "Ahmed",
        shiftNumber: 1,
        status: "OPEN",
        openingCash: 200,
        openedAt,
        branch: { id: "branch-1", name: "Main Pharmacy Branch" },
        cashDrops: [],
      });

      // 1 sale of 100 cash -> expected = 300
      prismaMock.sale.findMany.mockResolvedValue([
        { id: "S1", total: 100, paymentMethod: "CASH", cashAmount: 100, cardAmount: 0, creditAmount: 0 },
      ]);
      prismaMock.returnEntry.findMany.mockResolvedValue([]);

      prismaMock.posShift.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: "shift-1", ...data })
      );

      const zReport = await shiftsService.closeShift(mockScope, mockUser, {
        shiftId: "shift-1",
        actualCash: 300,
        closingNotes: "Drawer balanced perfectly",
      });

      expect(zReport.status).toBe("CLOSED");
      expect(zReport.actualCash).toBe(300);
      expect(zReport.cashVariance).toBe(0);
      expect(zReport.varianceStatus).toBe("BALANCED");
      expect(zReport.closedAt).toBeDefined();
    });

    it("detects cash shortage (SHORT) when actual cash is less than expected", async () => {
      const openedAt = new Date("2026-10-02T08:00:00Z");
      prismaMock.posShift.findFirst.mockResolvedValue({
        id: "shift-1",
        pharmacyId: "pharm-1",
        branchId: "branch-1",
        cashierId: "user-1",
        cashierName: "Ahmed",
        shiftNumber: 1,
        status: "OPEN",
        openingCash: 200,
        openedAt,
        branch: { id: "branch-1", name: "Main Pharmacy Branch" },
        cashDrops: [],
      });

      // Expected = 200 opening + 150 cash sales = 350
      prismaMock.sale.findMany.mockResolvedValue([
        { id: "S1", total: 150, paymentMethod: "CASH", cashAmount: 150, cardAmount: 0, creditAmount: 0 },
      ]);
      prismaMock.returnEntry.findMany.mockResolvedValue([]);
      prismaMock.posShift.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: "shift-1", ...data })
      );

      // Actual cash counted is only 330 (10 shortage)
      const zReport = await shiftsService.closeShift(mockScope, mockUser, {
        shiftId: "shift-1",
        actualCash: 330,
        closingNotes: "Missing 20 SAR - gave incorrect change to customer",
      });

      expect(zReport.actualCash).toBe(330);
      expect(zReport.cashVariance).toBe(-20);
      expect(zReport.varianceStatus).toBe("SHORT");
    });

    it("detects cash surplus (OVER) when actual cash is greater than expected", async () => {
      const openedAt = new Date("2026-10-02T08:00:00Z");
      prismaMock.posShift.findFirst.mockResolvedValue({
        id: "shift-1",
        pharmacyId: "pharm-1",
        branchId: "branch-1",
        cashierId: "user-1",
        cashierName: "Ahmed",
        shiftNumber: 1,
        status: "OPEN",
        openingCash: 100,
        openedAt,
        branch: { id: "branch-1", name: "Main Pharmacy Branch" },
        cashDrops: [],
      });

      prismaMock.sale.findMany.mockResolvedValue([]);
      prismaMock.returnEntry.findMany.mockResolvedValue([]);
      prismaMock.posShift.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: "shift-1", ...data })
      );

      // Expected = 100, Actual = 115 (+15 surplus)
      const zReport = await shiftsService.closeShift(mockScope, mockUser, {
        shiftId: "shift-1",
        actualCash: 115,
        closingNotes: "Over 15 SAR",
      });

      expect(zReport.actualCash).toBe(115);
      expect(zReport.cashVariance).toBe(15);
      expect(zReport.varianceStatus).toBe("OVER");
    });
  });
});
