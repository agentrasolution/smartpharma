/**
 * batch.service.ts
 * Pillar B – Drug Master Data & Batch Lifecycle
 *
 * Rules:
 *  - All quantities stored in base-unit integers (smallest dispensable unit).
 *  - FEFO (First Expired, First Out): batches sorted ascending by expiryDate.
 *  - A batch belongs to a specific branch; cross-branch visibility is read-only.
 */

import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";
import { stockMovementService } from "./stock-movement.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBatchInput {
  productId: string;
  batchNumber: string;
  expiryDate: string; // ISO date string
  quantityInBaseUnits: number;
  costPricePerUnit: number;
  salePricePerUnit: number;
  gtin?: string;
}

export interface AdjustBatchInput {
  batchId: string;
  deltaUnits: number; // positive = add, negative = consume
  reasonCode: string; // e.g. "ADJUSTMENT", "EXPIRED_DISCARD", "RETURN"
  referenceNumber?: string;
  createdById?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function batchWhere(scope: BranchScope) {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const batchService = {
  /**
   * List all active batches for a product, ordered FEFO.
   */
  async listForProduct(scope: BranchScope, productId: string) {
    return prisma.batch.findMany({
      where: {
        ...batchWhere(scope),
        productId,
        status: "ACTIVE",
      },
      orderBy: { expiryDate: "asc" }, // FEFO
      select: {
        id: true,
        batchNumber: true,
        expiryDate: true,
        quantityInBaseUnits: true,
        costPricePerUnit: true,
        salePricePerUnit: true,
        status: true,
        gtin: true,
        isRecalled: true,
      },
    });
  },

  /**
   * List all batches across all products for a branch (for stock overview).
   */
  async listAll(scope: BranchScope, filters?: { status?: string; isRecalled?: boolean }) {
    return prisma.batch.findMany({
      where: {
        ...batchWhere(scope),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.isRecalled !== undefined ? { isRecalled: filters.isRecalled } : {}),
      },
      orderBy: { expiryDate: "asc" },
      include: {
        product: { select: { id: true, name: true, genericName: true, dosageForm: true } },
      },
    });
  },

  /**
   * Get a single batch by ID.
   */
  async getById(scope: BranchScope, id: string) {
    const batch = await prisma.batch.findFirst({
      where: { id, ...batchWhere(scope) },
      include: {
        product: true,
        movements: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!batch) throw new NotFoundError("Batch");
    return batch;
  },

  /**
   * Receive a new batch (GRN / Purchase Receipt).
   * Creates the Batch record and logs a PURCHASE_RECEIPT movement.
   */
  async receive(scope: BranchScope, data: CreateBatchInput, createdById?: string) {
    if (!scope.branchId) throw new Error("Branch scope required to receive stock");

    // Calculate current stock balance for movement log
    const currentStock = await prisma.batch.aggregate({
      where: { ...batchWhere(scope), productId: data.productId, status: "ACTIVE" },
      _sum: { quantityInBaseUnits: true },
    });
    const balanceBefore = currentStock._sum.quantityInBaseUnits ?? 0;
    const balanceAfter = balanceBefore + data.quantityInBaseUnits;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const batch = await tx.batch.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
          productId: data.productId,
          batchNumber: data.batchNumber,
          expiryDate: new Date(data.expiryDate),
          quantityInBaseUnits: data.quantityInBaseUnits,
          costPricePerUnit: data.costPricePerUnit,
          salePricePerUnit: data.salePricePerUnit,
          gtin: data.gtin ?? null,
          status: "ACTIVE",
        },
      });

      // Log stock movement
      await tx.stockMovement.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
          productId: data.productId,
          batchId: batch.id,
          movementType: "PURCHASE_RECEIPT",
          quantityDelta: data.quantityInBaseUnits,
          balanceAfter,
          unitCost: data.costPricePerUnit,
          createdById: createdById ?? null,
        },
      });

      return batch;
    });
  },

  /**
   * Adjust batch quantity (manual correction, write-off, return, etc.).
   * deltaUnits can be positive or negative.
   */
  async adjust(scope: BranchScope, input: AdjustBatchInput) {
    const batch = await prisma.batch.findFirst({
      where: { id: input.batchId, ...batchWhere(scope) },
    });
    if (!batch) throw new NotFoundError("Batch");

    const newQty = batch.quantityInBaseUnits + input.deltaUnits;
    if (newQty < 0) throw new Error("Adjustment would result in negative stock");

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.batch.update({
        where: { id: input.batchId },
        data: {
          quantityInBaseUnits: newQty,
          status: newQty === 0 ? "DEPLETED" : batch.status,
        },
      });

      // Calculate branch-level balance across all batches for this product
      const allBatches = await tx.batch.aggregate({
        where: {
          pharmacyId: scope.pharmacyId,
          branchId: batch.branchId,
          productId: batch.productId,
          status: "ACTIVE",
        },
        _sum: { quantityInBaseUnits: true },
      });

      await tx.stockMovement.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId: batch.branchId,
          productId: batch.productId,
          batchId: input.batchId,
          movementType: "ADJUSTMENT",
          quantityDelta: input.deltaUnits,
          balanceAfter: allBatches._sum.quantityInBaseUnits ?? newQty,
          unitCost: batch.costPricePerUnit,
          reasonCode: input.reasonCode,
          referenceNumber: input.referenceNumber ?? null,
          createdById: input.createdById ?? null,
        },
      });

      return updated;
    });
  },

  /**
   * FEFO allocation: consume `unitsNeeded` from batches in FEFO order.
   * Returns the list of batch deductions made.
   * Used internally by the sales/dispensing service.
   */
  async allocateFefo(
    tx: Prisma.TransactionClient,
    scope: BranchScope,
    productId: string,
    unitsNeeded: number,
    context: { movementType: string; referenceNumber?: string; createdById?: string }
  ): Promise<Array<{ batchId: string; unitsConsumed: number }>> {
    const batches = await tx.batch.findMany({
      where: {
        pharmacyId: scope.pharmacyId,
        branchId: scope.branchId,
        productId,
        status: "ACTIVE",
        quantityInBaseUnits: { gt: 0 },
        isRecalled: false,
      },
      orderBy: { expiryDate: "asc" }, // FEFO
    });

    let remaining = unitsNeeded;
    const allocations: Array<{ batchId: string; unitsConsumed: number }> = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const consume = Math.min(batch.quantityInBaseUnits, remaining);
      const newQty = batch.quantityInBaseUnits - consume;

      await tx.batch.update({
        where: { id: batch.id },
        data: {
          quantityInBaseUnits: newQty,
          status: newQty === 0 ? "DEPLETED" : "ACTIVE",
        },
      });

      // Branch-level balance after deduction
      const runningBalance = batches.reduce((sum, b) => {
        if (b.id === batch.id) return sum + newQty;
        return sum + b.quantityInBaseUnits;
      }, 0) - remaining + consume;

      await tx.stockMovement.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
          productId,
          batchId: batch.id,
          movementType: context.movementType,
          quantityDelta: -consume,
          balanceAfter: Math.max(0, runningBalance - consume),
          unitCost: batch.costPricePerUnit,
          referenceNumber: context.referenceNumber ?? null,
          createdById: context.createdById ?? null,
        },
      });

      allocations.push({ batchId: batch.id, unitsConsumed: consume });
      remaining -= consume;
    }

    if (remaining > 0) {
      throw new Error(
        `Insufficient stock: needed ${unitsNeeded} units, only ${unitsNeeded - remaining} available`
      );
    }

    return allocations;
  },

  /**
   * Mark a batch as recalled.
   */
  async recall(scope: BranchScope, batchId: string, reason: string) {
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, ...batchWhere(scope) },
    });
    if (!batch) throw new NotFoundError("Batch");

    return prisma.batch.update({
      where: { id: batchId },
      data: { isRecalled: true, recallReason: reason, status: "RECALLED" },
    });
  },

  /**
   * Get batches expiring within `days` days (for expiry alerts).
   */
  async getExpiringSoon(scope: BranchScope, days = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return prisma.batch.findMany({
      where: {
        ...batchWhere(scope),
        status: "ACTIVE",
        expiryDate: { lte: cutoff },
        quantityInBaseUnits: { gt: 0 },
        isRecalled: false,
      },
      orderBy: { expiryDate: "asc" },
      include: {
        product: { select: { id: true, name: true, genericName: true, dosageForm: true } },
      },
    });
  },
};
