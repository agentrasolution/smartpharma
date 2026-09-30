/**
 * stock-movement.service.ts
 * Pillar C – Stock Movement Ledger
 *
 * Every inventory change (receipt, sale, return, adjustment, discard) is
 * logged as an immutable StockMovement record. This is the audit trail.
 */

import { prisma } from "../../services/prisma";
import type { BranchScope } from "../../middleware/auth";

export type MovementType =
  | "PURCHASE_RECEIPT"
  | "SALE"
  | "RETURN_IN"
  | "RETURN_OUT"
  | "ADJUSTMENT"
  | "EXPIRED_DISCARD"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export interface StockMovementFilter {
  productId?: string;
  batchId?: string;
  movementType?: MovementType;
  from?: string; // ISO date
  to?: string;   // ISO date
  page?: number;
  limit?: number;
}

export const stockMovementService = {
  /**
   * List stock movements with optional filters and pagination.
   */
  async list(scope: BranchScope, filters: StockMovementFilter = {}) {
    const { productId, batchId, movementType, from, to, page = 1, limit = 50 } = filters;

    const where = {
      pharmacyId: scope.pharmacyId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...(productId ? { productId } : {}),
      ...(batchId ? { batchId } : {}),
      ...(movementType ? { movementType } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: { select: { id: true, name: true, genericName: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        },
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },

  /**
   * Get a stock valuation snapshot: total units and total cost per product per branch.
   */
  async valuationSnapshot(scope: BranchScope) {
    const batches = await prisma.batch.groupBy({
      by: ["productId"],
      where: {
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        status: "ACTIVE",
      },
      _sum: { quantityInBaseUnits: true },
    });

    // Enrich with product info
    const productIds = batches.map((b) => b.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, genericName: true, dosageForm: true, baseUnit: true },
    });

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    return batches.map((b) => ({
      product: productMap[b.productId],
      totalUnits: b._sum.quantityInBaseUnits ?? 0,
    }));
  },

  /**
   * Movement summary by type for a date range (for reports/dashboard).
   */
  async summary(scope: BranchScope, from: string, to: string) {
    const movements = await prisma.stockMovement.groupBy({
      by: ["movementType"],
      where: {
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        createdAt: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      _sum: { quantityDelta: true },
      _count: true,
    });

    return movements.map((m) => ({
      type: m.movementType,
      totalDelta: m._sum.quantityDelta ?? 0,
      count: m._count,
    }));
  },
};
