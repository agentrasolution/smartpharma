import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import { emitEvent } from "../../socket";
import type { CreateStockInput } from "./purchases.schema";
import { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";

function branchWhere(scope: BranchScope) {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

export const purchasesService = {
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
    const product = await prisma.product.findFirst({
      where: { id: data.productId, ...branchWhere(scope) },
      select: { purchasePrice: true, salePrice: true },
    });

    const price = product?.purchasePrice ?? 0;
    const salePrice = product?.salePrice ?? 0;
    const totalValue = data.quantity * price;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const stockPurchase = await tx.stockPurchase.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
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
      const updated = await tx.stockPurchase.update({
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
};
