import { prisma } from "../../services/prisma";
import { NotFoundError, BadRequestError } from "../../utils/errors";
import type { CreateCustomerInput } from "./customers.schema";
import { Prisma } from "../../generated/prisma/client";

interface CustomerStats {
  total_purchases: number;
  outstanding_arrear: number;
  last_purchase: string | null;
}

const customerStatsSelect = `
  (SELECT COUNT(*)::int FROM sales s WHERE s.customer_id = c.id) AS total_purchases,
  COALESCE((SELECT SUM(a.balance_due) FROM arrears a WHERE a.customer_id = c.id AND a.status = 'pending'), 0) AS outstanding_arrear,
  (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id) AS last_purchase`;

export const customersService = {
  async list() {
    return prisma.$queryRawUnsafe<unknown[]>(
      `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone, c.created_at,
        ${customerStatsSelect}
       FROM customers c
       ORDER BY c.name ASC`,
    );
  },

  async search(query: string) {
    const q = `%${query}%`;
    return prisma.$queryRawUnsafe<unknown[]>(
      `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone, c.created_at,
        ${customerStatsSelect}
       FROM customers c
       WHERE c.name ILIKE $1 OR c.phone ILIKE $1 OR c.father_name ILIKE $1 OR c.father_phone ILIKE $1
       ORDER BY c.name LIMIT 20`,
      q,
    );
  },

  async getById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          include: { items: true },
        },
        arrears: {
          orderBy: { createdAt: "desc" },
          include: { payments: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    if (!customer) throw new NotFoundError("Customer");

    const [stats] = await prisma.$queryRawUnsafe<CustomerStats[]>(
      `SELECT
        ${customerStatsSelect}
       FROM customers c
       WHERE c.id = $1
       GROUP BY c.id`,
      id,
    );

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      father_name: customer.fatherName,
      father_phone: customer.fatherPhone,
      created_at: customer.createdAt.toISOString(),
      total_purchases: stats?.total_purchases ?? 0,
      outstanding_arrear: stats?.outstanding_arrear ?? 0,
      last_purchase: stats?.last_purchase ?? null,
      purchases: customer.sales.map((s) => ({
        id: s.id,
        customer_id: s.customerId ?? undefined,
        subtotal: s.subtotal,
        discount: s.discount,
        total: s.total,
        amount_paid: s.amountPaid,
        change: s.change,
        status: s.status,
        created_at: s.createdAt.toISOString(),
        items: s.items.map((i) => ({
          id: i.id,
          sale_id: i.saleId,
          product_id: i.productId,
          product_name: i.productName,
          barcode: i.barcode,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          subtotal: i.subtotal,
        })),
      })),
      arrears: customer.arrears.map((a) => ({
        id: a.id,
        sale_id: a.saleId ?? "",
        customer_id: a.customerId,
        total_bill: a.totalBill,
        amount_paid: a.amountPaid,
        balance_due: a.balanceDue,
        status: a.status,
        created_at: a.createdAt.toISOString(),
        payments: a.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          payment_sale_id: p.paymentSaleId ?? null,
          created_at: p.createdAt.toISOString(),
        })),
      })),
    };
  },

  async create(data: CreateCustomerInput) {
    return prisma.customer.create({
      data: {
        name: data.name,
        phone: data.phone ?? "",
        address: data.address ?? "",
        fatherName: data.fatherName ?? "",
        fatherPhone: data.fatherPhone ?? "",
      },
    });
  },

  async update(id: string, data: CreateCustomerInput) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Customer");

    return prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone ?? "",
        address: data.address ?? "",
        fatherName: data.fatherName ?? "",
        fatherPhone: data.fatherPhone ?? "",
      },
    });
  },

  async delete(id: string, force = false) {
    const salesCount = await prisma.sale.count({ where: { customerId: id } });
    const arrearsCount = await prisma.arrear.count({ where: { customerId: id } });

    if ((salesCount > 0 || arrearsCount > 0) && !force) {
      throw new BadRequestError(
        `Customer has ${salesCount} invoice(s) and ${arrearsCount} arrear(s). Use force delete to remove.`,
      );
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (force) {
        await tx.sale.updateMany({ where: { customerId: id }, data: { customerId: null } });
        await tx.arrear.deleteMany({ where: { customerId: id } });
      }
      await tx.customer.delete({ where: { id } });
      return { success: true };
    });
  },
};
