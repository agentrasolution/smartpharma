import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import { emitEvent } from "../../socket";
import type { CreateSaleInput } from "./sales.schema";
import { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";

function branchWhere(scope: BranchScope): Prisma.SaleWhereInput {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

export const salesService = {
  async create(data: CreateSaleInput, scope: BranchScope) {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const prefix = `${yy}${mm}-`;

    const last = await prisma.sale.findFirst({
      where: { id: { startsWith: prefix }, ...branchWhere(scope) },
      orderBy: { id: "desc" },
    });

    let nextNum = 1;
    if (last) {
      nextNum = parseInt(last.id.slice(-6), 10) + 1;
    }
    const saleId = `${prefix}${nextNum.toString().padStart(6, "0")}`;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const sale = await tx.sale.create({
        data: {
          id: saleId,
          pharmacyId: scope.pharmacyId,
          branchId: scope.branchId!,
          customerId: data.customerId ?? null,
          subtotal: data.subtotal,
          discount: data.discount,
          total: data.total,
          amountPaid: data.amountPaid,
          change: Math.max(0, data.amountPaid - data.total),
          status: data.amountPaid >= data.total ? "paid" : "partial",
        },
      });

      for (const item of data.items) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            productName: item.productName,
            barcode: item.barcode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

      if (data.amountPaid < data.total && data.customerId) {
        await tx.arrear.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId: scope.branchId!,
            saleId: sale.id,
            customerId: data.customerId,
            totalBill: data.total,
            amountPaid: data.amountPaid,
            balanceDue: data.total - data.amountPaid,
            status: "pending",
          },
        });
      }

      const result = await tx.sale.findUnique({
        where: { id: sale.id },
        include: { items: true },
      });

      emitEvent("sale:created", result);
      return result;
    });
  },

  async listRecent(scope: BranchScope, limit = 10) {
    return prisma.sale.findMany({
      where: branchWhere(scope),
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true, returns: true } },
      },
    });
  },

  async listByDate(scope: BranchScope, dateStr: string, tzOffsetMinutes?: number) {
    const offsetMs = (tzOffsetMinutes ?? 0) * 60000;
    const start = new Date(`${dateStr}T00:00:00.000Z`).getTime() - offsetMs;
    const end = start + 24 * 60 * 60 * 1000 - 1;

    return prisma.sale.findMany({
      where: {
        ...branchWhere(scope),
        createdAt: { gte: new Date(start), lte: new Date(end) },
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true, returns: true } },
      },
    });
  },

  async search(scope: BranchScope, q: string, limit = 50) {
    const query = q.trim();
    return prisma.sale.findMany({
      where: {
        ...branchWhere(scope),
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { customer: { is: { name: { contains: query, mode: "insensitive" } } } },
          { items: { some: { productName: { contains: query, mode: "insensitive" } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true, returns: true } },
      },
    });
  },

  async listAll(scope: BranchScope, opts?: { search?: string; dateFrom?: string; dateTo?: string; tzOffsetMinutes?: number }) {
    const where: Record<string, unknown> = { ...branchWhere(scope) };
    const offsetMs = (opts?.tzOffsetMinutes ?? 0) * 60000;

    if (opts?.dateFrom || opts?.dateTo) {
      where.createdAt = {};
      if (opts.dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(new Date(`${opts.dateFrom}T00:00:00.000Z`).getTime() - offsetMs);
      }
      if (opts.dateTo) {
        (where.createdAt as Record<string, Date>).lte = new Date(new Date(`${opts.dateTo}T23:59:59.999Z`).getTime() - offsetMs);
      }
    }

    const search = opts?.search?.trim();
    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { customer: { is: { name: { contains: search, mode: "insensitive" } } } },
        { items: { some: { productName: { contains: search, mode: "insensitive" } } } },
      ];
    }

    return prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true, returns: true } },
      },
    });
  },

  async getById(scope: BranchScope, id: string) {
    const sale = await prisma.sale.findFirst({
      where: { id, ...branchWhere(scope) },
      include: {
        customer: { select: { name: true } },
        items: true,
        returns: { include: { items: true } },
        _count: { select: { returns: true } },
      },
    });
    if (!sale) throw new NotFoundError("Sale");
    return sale;
  },
};
