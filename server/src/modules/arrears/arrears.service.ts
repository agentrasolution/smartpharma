import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../utils/errors";
import { Prisma } from "../../generated/prisma/client";
import { authService } from "../auth/auth.service";

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
  async list(status?: string) {
    const where = status && status !== "all" ? { status } : {};
    return prisma.arrear.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  async create(data: { customerId: string; totalBill: number; amountPaid?: number; saleId?: string }) {
    const amountPaid = data.amountPaid ?? 0;
    if (amountPaid < 0 || amountPaid > data.totalBill) {
      throw new BadRequestError("Amount paid cannot exceed total bill");
    }
    const balanceDue = data.totalBill - amountPaid;
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const arrear = await tx.arrear.create({
        data: {
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

  async recordPayment(id: string, amount: number, password: string) {
    const { valid } = await authService.verifyPassword(password);
    if (!valid) throw new UnauthorizedError("Invalid admin password");

    const arrear = await prisma.arrear.findUnique({
      where: { id },
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
        where: { id: { startsWith: prefix } },
        orderBy: { id: "desc" },
      });
      const saleId = generateSaleId(prefix, last?.id ?? null);

      const paymentSale = await tx.sale.create({
        data: {
          id: saleId,
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

  async settle(id: string, password: string) {
    const { valid } = await authService.verifyPassword(password);
    if (!valid) throw new UnauthorizedError("Invalid admin password");

    const arrear = await prisma.arrear.findUnique({
      where: { id },
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
        where: { id: { startsWith: prefix } },
        orderBy: { id: "desc" },
      });
      const saleId = generateSaleId(prefix, last?.id ?? null);

      const paymentSale = await tx.sale.create({
        data: {
          id: saleId,
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

  async delete(id: string) {
    const arrear = await prisma.arrear.findUnique({ where: { id } });
    if (!arrear) throw new NotFoundError("Arrear");
    await prisma.arrear.delete({ where: { id } });
    return { success: true };
  },
};
