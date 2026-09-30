import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import { emitEvent } from "../../socket";
import type { CreateReturnInput } from "./returns.schema";
import { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";

function branchWhere(scope: BranchScope) {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

export const returnsService = {
  async list(scope: BranchScope) {
    return prisma.returnEntry.findMany({
      where: branchWhere(scope),
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        sale: { include: { customer: { select: { name: true } } } },
      },
    });
  },

  async getById(scope: BranchScope, id: string) {
    const entry = await prisma.returnEntry.findFirst({
      where: { id, ...branchWhere(scope) },
      include: {
        items: true,
        sale: { include: { customer: { select: { name: true } } } },
      },
    });
    if (!entry) throw new NotFoundError("Return");
    return entry;
  },

  async create(scope: BranchScope, data: CreateReturnInput) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId, ...branchWhere(scope) },
        include: {
          items: true,
          returns: { include: { items: true } },
        },
      });
      if (!sale) throw new NotFoundError("Sale");

      const soldQty: Record<string, number> = {};
      for (const si of sale.items) {
        soldQty[si.productId] = (soldQty[si.productId] ?? 0) + si.quantity;
      }

      const returnedQty: Record<string, number> = {};
      for (const r of sale.returns) {
        for (const ri of r.items) {
          returnedQty[ri.productId] = (returnedQty[ri.productId] ?? 0) + ri.quantity;
        }
      }

      for (const item of data.items) {
        const maxReturnable = (soldQty[item.productId] ?? 0) - (returnedQty[item.productId] ?? 0);
        if (item.quantity > maxReturnable) {
          throw new BadRequestError(
            `Cannot return more than ${maxReturnable} of "${item.productName}" (remaining for this invoice)`
          );
        }
      }

      const returnEntry = await tx.returnEntry.create({
        data: {
          pharmacyId: sale.pharmacyId,
          branchId: sale.branchId,
          saleId: data.saleId,
          refundAmount: data.refundAmount,
          reason: data.reason ?? "",
        },
      });

      for (const item of data.items) {
        await tx.returnItem.create({
          data: {
            returnId: returnEntry.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            refundAmount: item.refundAmount,
          },
        });

        // ------------------------------------------------------------------
        // RETURN_IN: restore units to the latest-expiry batch (LIFO on return)
        // This keeps FEFO ordering intact for future sales.
        // ------------------------------------------------------------------
        const targetBatch = await tx.batch.findFirst({
          where: {
            pharmacyId: scope.pharmacyId,
            branchId: scope.branchId ?? sale.branchId,
            productId: item.productId,
            status: { in: ["ACTIVE", "DEPLETED"] },
            isRecalled: false,
          },
          orderBy: { expiryDate: "desc" }, // LIFO on return — put back into latest batch
        });

        if (targetBatch) {
          const newQty = targetBatch.quantityInBaseUnits + item.quantity;

          await tx.batch.update({
            where: { id: targetBatch.id },
            data: {
              quantityInBaseUnits: newQty,
              status: "ACTIVE",
            },
          });

          // Compute balance after restore
          const allActiveBatches = await tx.batch.aggregate({
            where: {
              pharmacyId: scope.pharmacyId,
              branchId: scope.branchId ?? sale.branchId,
              productId: item.productId,
              status: "ACTIVE",
            },
            _sum: { quantityInBaseUnits: true },
          });

          await tx.stockMovement.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId: scope.branchId ?? sale.branchId,
              productId: item.productId,
              batchId: targetBatch.id,
              movementType: "RETURN_IN",
              quantityDelta: item.quantity,
              balanceAfter: (allActiveBatches._sum.quantityInBaseUnits ?? 0),
              unitCost: targetBatch.costPricePerUnit,
              referenceNumber: sale.id,
              reasonCode: data.reason ?? null,
            },
          });
        } else {
          // No batch found (legacy product) — log against null batch
          await tx.stockMovement.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId: scope.branchId ?? sale.branchId,
              productId: item.productId,
              batchId: null,
              movementType: "RETURN_IN",
              quantityDelta: item.quantity,
              balanceAfter: 0, // unknown without batch
              unitCost: 0,
              referenceNumber: sale.id,
              reasonCode: data.reason ?? null,
            },
          });
        }

        // Keep legacy stockQty in sync
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
      }

      const result = await tx.returnEntry.findUnique({
        where: { id: returnEntry.id },
        include: {
          items: true,
          sale: { include: { customer: { select: { name: true } } } },
        },
      });

      emitEvent("return:created", result);
      return result;
    });
  },
};
