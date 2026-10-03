/**
 * shifts.service.ts
 * Pillar F – Point of Sale & Shift Management
 *
 * Implements:
 * 1. Register opening with initial cash float.
 * 2. Active shift lookup per cashier & branch.
 * 3. Mid-shift cash drops (to safe) and petty cash payouts.
 * 4. Real-time X-Report (mid-shift reading without closing).
 * 5. Shift closing with counted cash reconciliation, variance calculation, and immutable Z-Report.
 * 6. Historical shifts ledger with filtering.
 */

import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import { round2 } from "../../inventory/math";
import type { BranchScope } from "../../middleware/auth";
import type {
  OpenShiftInput,
  CashDropInput,
  CloseShiftInput,
  ListShiftsQuery,
} from "./shifts.schema";

export interface ShiftUserContext {
  id: string;
  name?: string;
  username: string;
}

export interface XReportData {
  shiftId: string;
  shiftNumber: number;
  status: string;
  cashierName: string;
  branchName: string;
  openedAt: string;
  readingAt: string;
  openingCash: number;
  salesSummary: {
    totalTransactions: number;
    grossSales: number;
    cashSales: { count: number; amount: number };
    cardSales: { count: number; amount: number };
    creditSales: { count: number; amount: number };
    splitSales: { count: number; amount: number };
  };
  returnsSummary: {
    totalReturns: number;
    cashRefunds: number;
    nonCashRefunds: number;
  };
  cashMovements: {
    dropsToSafe: { count: number; total: number };
    payouts: { count: number; total: number };
    floatAdds: { count: number; total: number };
    list: Array<{
      id: string;
      type: string;
      amount: number;
      reason: string;
      createdAt: string;
    }>;
  };
  cashDrawerSummary: {
    openingFloat: number;
    totalCashIn: number; // opening + cashSales + floatAdds
    totalCashOut: number; // cashRefunds + dropsToSafe + payouts
    expectedCashInDrawer: number;
  };
}

export interface ZReportData extends XReportData {
  closedAt: string;
  actualCash: number;
  cashVariance: number;
  varianceStatus: "BALANCED" | "OVER" | "SHORT";
  closingNotes: string;
}

async function resolveBranchId(scope: BranchScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const branch = await prisma.branch.findFirst({
    where: { pharmacyId: scope.pharmacyId },
    orderBy: { createdAt: "asc" },
  });
  if (!branch) {
    throw new BadRequestError("No pharmacy branch found");
  }
  return branch.id;
}

export async function getActiveShift(
  scope: BranchScope,
  cashierId?: string
) {
  const branchId = await resolveBranchId(scope);
  const where: any = {
    pharmacyId: scope.pharmacyId,
    branchId,
    status: "OPEN",
  };
  if (cashierId) {
    where.cashierId = cashierId;
  }

  const shift = await prisma.posShift.findFirst({
    where,
    include: {
      cashDrops: { orderBy: { createdAt: "desc" } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  if (!shift) {
    return null;
  }

  // Calculate live expected cash
  const xReport = await calculateShiftMetrics(shift.id, scope.pharmacyId);
  return {
    ...shift,
    liveExpectedCash: xReport.cashDrawerSummary.expectedCashInDrawer,
    metrics: xReport,
  };
}

export async function openShift(
  scope: BranchScope,
  user: ShiftUserContext,
  input: OpenShiftInput
) {
  const branchId = await resolveBranchId(scope);

  // Check if cashier already has an OPEN shift in this branch
  const existing = await prisma.posShift.findFirst({
    where: {
      pharmacyId: scope.pharmacyId,
      branchId,
      cashierId: user.id,
      status: "OPEN",
    },
  });

  if (existing) {
    throw new BadRequestError(
      `You already have an active open shift (#${existing.shiftNumber}). Please close it before opening a new shift.`
    );
  }

  // Next shift number for this branch
  const count = await prisma.posShift.count({
    where: {
      pharmacyId: scope.pharmacyId,
      branchId,
    },
  });
  const shiftNumber = count + 1;
  const openingFloat = round2(input.openingCash);

  const shift = await prisma.posShift.create({
    data: {
      pharmacyId: scope.pharmacyId,
      branchId,
      cashierId: user.id,
      cashierName: user.name || user.username,
      shiftNumber,
      status: "OPEN",
      openingCash: openingFloat,
      expectedCash: openingFloat,
      closingNotes: input.notes || "",
    },
    include: {
      branch: { select: { id: true, name: true } },
    },
  });

  return shift;
}

export async function recordCashDrop(
  scope: BranchScope,
  user: ShiftUserContext,
  input: CashDropInput
) {
  const shift = await prisma.posShift.findFirst({
    where: {
      id: input.shiftId,
      pharmacyId: scope.pharmacyId,
    },
  });

  if (!shift) {
    throw new NotFoundError("Shift not found");
  }

  if (shift.status !== "OPEN") {
    throw new BadRequestError("Cannot record cash drop on a closed shift");
  }

  const amount = round2(input.amount);
  const drop = await prisma.cashDrop.create({
    data: {
      shiftId: shift.id,
      pharmacyId: scope.pharmacyId,
      branchId: shift.branchId,
      userId: user.id,
      userName: user.name || user.username,
      type: input.type,
      amount,
      reason: input.reason,
    },
  });

  // Update totalCashDrops on shift
  const allDrops = await prisma.cashDrop.findMany({
    where: { shiftId: shift.id },
  });
  const totalDeducted = allDrops
    .filter((d) => d.type === "DROP" || d.type === "PAYOUT")
    .reduce((sum, d) => sum + d.amount, 0);

  await prisma.posShift.update({
    where: { id: shift.id },
    data: { totalCashDrops: round2(totalDeducted) },
  });

  return drop;
}

async function calculateShiftMetrics(shiftId: string, pharmacyId: string): Promise<XReportData> {
  const shift = await prisma.posShift.findFirst({
    where: { id: shiftId, pharmacyId },
    include: {
      branch: { select: { id: true, name: true } },
      cashDrops: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!shift) {
    throw new NotFoundError("Shift not found");
  }

  // Find all sales for this shift
  const sales = await prisma.sale.findMany({
    where: {
      pharmacyId,
      OR: [
        { shiftId: shift.id },
        {
          cashierId: shift.cashierId,
          branchId: shift.branchId,
          createdAt: {
            gte: shift.openedAt,
            ...(shift.closedAt ? { lte: shift.closedAt } : {}),
          },
        },
      ],
    },
  });

  // Find all returns for this shift
  const returns = await prisma.returnEntry.findMany({
    where: {
      pharmacyId,
      branchId: shift.branchId,
      createdAt: {
        gte: shift.openedAt,
        ...(shift.closedAt ? { lte: shift.closedAt } : {}),
      },
    },
  });

  // Calculate sales summary
  let totalGross = 0;
  let cashSalesAmount = 0;
  let cashSalesCount = 0;
  let cardSalesAmount = 0;
  let cardSalesCount = 0;
  let creditSalesAmount = 0;
  let creditSalesCount = 0;
  let splitSalesAmount = 0;
  let splitSalesCount = 0;

  for (const sale of sales) {
    totalGross += sale.total;
    const method = (sale.paymentMethod || "").toUpperCase();

    if (method === "SPLIT") {
      splitSalesCount++;
      splitSalesAmount += sale.total;
      cashSalesAmount += sale.cashAmount || 0;
      cardSalesAmount += sale.cardAmount || 0;
      creditSalesAmount += sale.creditAmount || 0;
    } else if (method === "CARD" || method === "MADA") {
      cardSalesCount++;
      cardSalesAmount += sale.total;
    } else if (method === "CREDIT") {
      creditSalesCount++;
      creditSalesAmount += sale.total;
    } else {
      // Default to cash
      cashSalesCount++;
      cashSalesAmount += sale.total;
    }
  }

  // Calculate returns
  let totalReturnsAmount = 0;
  let cashRefundsAmount = 0;
  let nonCashRefundsAmount = 0;

  for (const ret of returns) {
    totalReturnsAmount += ret.totalRefund;
    if ((ret.refundMethod || "CASH").toUpperCase() === "CASH") {
      cashRefundsAmount += ret.totalRefund;
    } else {
      nonCashRefundsAmount += ret.totalRefund;
    }
  }

  // Calculate cash drops
  let dropsToSafeTotal = 0;
  let dropsToSafeCount = 0;
  let payoutsTotal = 0;
  let payoutsCount = 0;
  let floatAddsTotal = 0;
  let floatAddsCount = 0;

  for (const drop of shift.cashDrops) {
    if (drop.type === "DROP") {
      dropsToSafeCount++;
      dropsToSafeTotal += drop.amount;
    } else if (drop.type === "PAYOUT") {
      payoutsCount++;
      payoutsTotal += drop.amount;
    } else if (drop.type === "FLOAT_ADD") {
      floatAddsCount++;
      floatAddsTotal += drop.amount;
    }
  }

  const openingFloat = shift.openingCash;
  const totalCashIn = round2(openingFloat + cashSalesAmount + floatAddsTotal);
  const totalCashOut = round2(cashRefundsAmount + dropsToSafeTotal + payoutsTotal);
  const expectedCashInDrawer = round2(totalCashIn - totalCashOut);

  return {
    shiftId: shift.id,
    shiftNumber: shift.shiftNumber,
    status: shift.status,
    cashierName: shift.cashierName,
    branchName: shift.branch?.name || "Main Branch",
    openedAt: shift.openedAt.toISOString(),
    readingAt: new Date().toISOString(),
    openingCash: round2(openingFloat),
    salesSummary: {
      totalTransactions: sales.length,
      grossSales: round2(totalGross),
      cashSales: { count: cashSalesCount, amount: round2(cashSalesAmount) },
      cardSales: { count: cardSalesCount, amount: round2(cardSalesAmount) },
      creditSales: { count: creditSalesCount, amount: round2(creditSalesAmount) },
      splitSales: { count: splitSalesCount, amount: round2(splitSalesAmount) },
    },
    returnsSummary: {
      totalReturns: round2(totalReturnsAmount),
      cashRefunds: round2(cashRefundsAmount),
      nonCashRefunds: round2(nonCashRefundsAmount),
    },
    cashMovements: {
      dropsToSafe: { count: dropsToSafeCount, total: round2(dropsToSafeTotal) },
      payouts: { count: payoutsCount, total: round2(payoutsTotal) },
      floatAdds: { count: floatAddsCount, total: round2(floatAddsTotal) },
      list: shift.cashDrops.map((d) => ({
        id: d.id,
        type: d.type,
        amount: round2(d.amount),
        reason: d.reason,
        createdAt: d.createdAt.toISOString(),
      })),
    },
    cashDrawerSummary: {
      openingFloat: round2(openingFloat),
      totalCashIn,
      totalCashOut,
      expectedCashInDrawer,
    },
  };
}

export async function getXReport(
  scope: BranchScope,
  shiftId: string
): Promise<XReportData> {
  return calculateShiftMetrics(shiftId, scope.pharmacyId);
}

export async function closeShift(
  scope: BranchScope,
  user: ShiftUserContext,
  input: CloseShiftInput
): Promise<ZReportData> {
  const shift = await prisma.posShift.findFirst({
    where: {
      id: input.shiftId,
      pharmacyId: scope.pharmacyId,
    },
  });

  if (!shift) {
    throw new NotFoundError("Shift not found");
  }

  if (shift.status !== "OPEN") {
    throw new BadRequestError("Shift is already closed");
  }

  const xReport = await calculateShiftMetrics(shift.id, scope.pharmacyId);
  const actualCash = round2(input.actualCash);
  const expectedCash = xReport.cashDrawerSummary.expectedCashInDrawer;
  const cashVariance = round2(actualCash - expectedCash);

  let varianceStatus: "BALANCED" | "OVER" | "SHORT" = "BALANCED";
  if (cashVariance > 0.01) {
    varianceStatus = "OVER";
  } else if (cashVariance < -0.01) {
    varianceStatus = "SHORT";
  }

  const closedAt = new Date();

  const updated = await prisma.posShift.update({
    where: { id: shift.id },
    data: {
      status: "CLOSED",
      closedAt,
      actualCash,
      expectedCash,
      cashVariance,
      totalCashSales: xReport.salesSummary.cashSales.amount,
      totalCardSales: xReport.salesSummary.cardSales.amount,
      totalCreditSales: xReport.salesSummary.creditSales.amount,
      totalSalesCount: xReport.salesSummary.totalTransactions,
      totalReturns: xReport.returnsSummary.totalReturns,
      closingNotes: input.closingNotes || "",
    },
  });

  return {
    ...xReport,
    status: "CLOSED",
    closedAt: closedAt.toISOString(),
    actualCash,
    cashVariance,
    varianceStatus,
    closingNotes: updated.closingNotes || "",
  };
}

export async function listShifts(
  scope: BranchScope,
  query: ListShiftsQuery
) {
  const branchId = await resolveBranchId(scope);
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: any = {
    pharmacyId: scope.pharmacyId,
    branchId,
  };

  if (query.status) {
    where.status = query.status;
  }
  if (query.cashierId) {
    where.cashierId = query.cashierId;
  }
  if (query.from || query.to) {
    where.openedAt = {};
    if (query.from) where.openedAt.gte = new Date(query.from);
    if (query.to) where.openedAt.lte = new Date(query.to);
  }

  const [total, shifts] = await Promise.all([
    prisma.posShift.count({ where }),
    prisma.posShift.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { openedAt: "desc" },
      include: {
        branch: { select: { id: true, name: true } },
        cashDrops: true,
      },
    }),
  ]);

  return {
    data: shifts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getShiftById(
  scope: BranchScope,
  shiftId: string
) {
  const shift = await prisma.posShift.findFirst({
    where: { id: shiftId, pharmacyId: scope.pharmacyId },
    include: {
      branch: { select: { id: true, name: true } },
      cashDrops: { orderBy: { createdAt: "desc" } },
      sales: {
        select: {
          id: true,
          total: true,
          paymentMethod: true,
          amountPaid: true,
          cashAmount: true,
          cardAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!shift) {
    throw new NotFoundError("Shift not found");
  }

  const metrics = await calculateShiftMetrics(shift.id, scope.pharmacyId);
  return {
    ...shift,
    metrics,
  };
}
