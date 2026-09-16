import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../utils/errors";
import { Prisma } from "../../generated/prisma/client";
import { authService } from "../auth/auth.service";
import type { BranchScope } from "../../middleware/auth";

function generateSaleId(prefix: string, lastId: string | null) {
  let nextNum = 1;
  if (lastId) {
    nextNum = parseInt(lastId.slice(-6), 10) + 1;
  }
  return `${prefix}${nextNum.toString().padStart(6, "0")}`;
}

function makeSalePrefix(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  return `${yy}${mm}-`;
}

export const arrearsService = {
  async list(scope: BranchScope, status?: string) {
    const where: Record<string, unknown> = {
      pharmacyId: scope.pharmacyId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
    };
    if (status && status !== "all") {
      where.status = status;
    }
    return prisma.arrear.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  async create(scope: BranchScope, data: { customerId: string; totalBill: number; amountPaid?: number; saleId?: string }) {
    const amountPaid = data.amountPaid ?? 0;
    if (amountPaid < 0 || amountPaid > data.totalBill) {
      throw new BadRequestError("Amount paid cannot exceed total bill");
    }
    const balanceDue = data.totalBill - amountPaid;
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const arrear = await tx.arrear.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
          saleId: data.saleId ?? null,
          customerId: data.customerId,
          totalBill: data.totalBill,
          amountPaid,
          balanceDue: Math.max(0, balanceDue),
          status: balanceDue <= 0 ? "settled" : "pending",
        },
        include: { customer: { select: { name: true } } },
      });

      if (amountPaid > 0) {
        await tx.arrearPayment.create({
          data: { arrearId: arrear.id, amount: amountPaid },
        });
      }

      return tx.arrear.findUniqueOrThrow({
        where: { id: arrear.id },
        include: {
          customer: { select: { name: true } },
          payments: { orderBy: { createdAt: "asc" } },
        },
      });
    });
  },

  async recordPayment(scope: BranchScope, id: string, amount: number, password: string) {
    const { valid } = await authService.verifyPassword(scope.pharmacyId, password);
    if (!valid) throw new UnauthorizedError("Invalid admin password");

    const arrear = await prisma.arrear.findFirst({
      where: {
        id,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      include: { customer: { select: { name: true } } },
    });
    if (!arrear) throw new NotFoundError("Arrear");

    if (amount > arrear.balanceDue) {
      throw new BadRequestError(`Payment cannot exceed the balance due of ${arrear.balanceDue}`);
    }

    const newPaid = arrear.amountPaid + amount;
    const newBalance = Math.max(0, arrear.totalBill - newPaid);
    const newStatus = newBalance <= 0 ? "settled" : "pending";

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.arrear.update({
        where: { id },
        data: { amountPaid: newPaid, balanceDue: newBalance, status: newStatus },
        include: { customer: { select: { name: true } } },
      });

      if (arrear.saleId) {
        await tx.sale.update({ where: { id: arrear.saleId }, data: { status: "paid" } });
      }

      const prefix = makeSalePrefix();
      const last = await tx.sale.findFirst({
        where: { id: { startsWith: prefix }, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
        orderBy: { id: "desc" },
      });
      const saleId = generateSaleId(prefix, last?.id ?? null);

      const paymentSale = await tx.sale.create({
        data: {
          id: saleId,
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
          customerId: arrear.customerId,
          subtotal: amount,
          discount: 0,
          total: amount,
          amountPaid: amount,
          change: 0,
          status: "paid",
        },
      });

      await tx.arrearPayment.create({
        data: { arrearId: arrear.id, amount, paymentSaleId: paymentSale.id },
      });

      const withPayments = await tx.arrear.findUniqueOrThrow({
        where: { id },
        include: {
          customer: { select: { name: true } },
          payments: { orderBy: { createdAt: "asc" } },
        },
      });

      return { arrear: withPayments, paymentSaleId: paymentSale.id };
    });
  },

  async settle(scope: BranchScope, id: string, password: string) {
    const { valid } = await authService.verifyPassword(scope.pharmacyId, password);
    if (!valid) throw new UnauthorizedError("Invalid admin password");

    const arrear = await prisma.arrear.findFirst({
      where: {
        id,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      include: { customer: { select: { name: true } } },
    });
    if (!arrear) throw new NotFoundError("Arrear");

    const settleAmount = arrear.balanceDue;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.arrear.update({
        where: { id },
        data: { amountPaid: arrear.totalBill, balanceDue: 0, status: "settled" },
        include: { customer: { select: { name: true } } },
      });

      if (arrear.saleId) {
        await tx.sale.update({ where: { id: arrear.saleId }, data: { status: "paid" } });
      }

      const prefix = makeSalePrefix();
      const last = await tx.sale.findFirst({
        where: { id: { startsWith: prefix }, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
        orderBy: { id: "desc" },
      });
      const saleId = generateSaleId(prefix, last?.id ?? null);

      const paymentSale = await tx.sale.create({
        data: {
          id: saleId,
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
          customerId: arrear.customerId,
          subtotal: settleAmount,
          discount: 0,
          total: settleAmount,
          amountPaid: settleAmount,
          change: 0,
          status: "paid",
        },
      });

      if (settleAmount > 0) {
        await tx.arrearPayment.create({
          data: { arrearId: arrear.id, amount: settleAmount, paymentSaleId: paymentSale.id },
        });
      }

      const withPayments = await tx.arrear.findUniqueOrThrow({
        where: { id },
        include: {
          customer: { select: { name: true } },
          payments: { orderBy: { createdAt: "asc" } },
        },
      });

      return { arrear: withPayments, paymentSaleId: paymentSale.id };
    });
  },

  async delete(scope: BranchScope, id: string) {
    const arrear = await prisma.arrear.findFirst({
      where: {
        id,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
    });
    if (!arrear) throw new NotFoundError("Arrear");
    await prisma.arrear.delete({ where: { id } });
    return { success: true };
  },
};
