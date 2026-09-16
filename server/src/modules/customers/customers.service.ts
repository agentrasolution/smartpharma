import { prisma } from "../../services/prisma";
import { NotFoundError, BadRequestError } from "../../utils/errors";
import type { CreateCustomerInput } from "./customers.schema";
import { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";

interface CustomerStats {
  total_purchases: number;
  outstanding_arrear: number;
  last_purchase: string | null;
}

function buildCustomerStatsSelect(scope: BranchScope): string {
  if (scope.branchId) {
    return `
      (SELECT COUNT(*)::int FROM sales s WHERE s.customer_id = c.id AND s.pharmacy_id = $1 AND s.branch_id = $2) AS total_purchases,
      COALESCE((SELECT SUM(a.balance_due) FROM arrears a WHERE a.customer_id = c.id AND a.pharmacy_id = $1 AND a.branch_id = $2 AND a.status = 'pending'), 0) AS outstanding_arrear,
      (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.pharmacy_id = $1 AND s.branch_id = $2) AS last_purchase`;
  }
  return `
    (SELECT COUNT(*)::int FROM sales s WHERE s.customer_id = c.id AND s.pharmacy_id = $1) AS total_purchases,
    COALESCE((SELECT SUM(a.balance_due) FROM arrears a WHERE a.customer_id = c.id AND a.pharmacy_id = $1 AND a.status = 'pending'), 0) AS outstanding_arrear,
    (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.pharmacy_id = $1) AS last_purchase`;
}

export const customersService = {
  async list(scope: BranchScope) {
    const customerStatsSelect = buildCustomerStatsSelect(scope);
    if (scope.branchId) {
      return prisma.$queryRawUnsafe<unknown[]>(
        `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone, c.created_at,
          ${customerStatsSelect}
         FROM customers c
         WHERE c.pharmacy_id = $1 AND c.branch_id = $2
         ORDER BY c.name ASC`,
        scope.pharmacyId,
        scope.branchId,
      );
    }
    return prisma.$queryRawUnsafe<unknown[]>(
      `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone, c.created_at,
        ${customerStatsSelect}
       FROM customers c
       WHERE c.pharmacy_id = $1
       ORDER BY c.name ASC`,
      scope.pharmacyId,
    );
  },

  async search(scope: BranchScope, query: string) {
    const q = `%${query}%`;
    const customerStatsSelect = buildCustomerStatsSelect(scope);
    if (scope.branchId) {
      return prisma.$queryRawUnsafe<unknown[]>(
        `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone, c.created_at,
          ${customerStatsSelect}
         FROM customers c
         WHERE c.pharmacy_id = $1 AND c.branch_id = $2
           AND (c.name ILIKE $3 OR c.phone ILIKE $3 OR c.father_name ILIKE $3 OR c.father_phone ILIKE $3)
         ORDER BY c.name LIMIT 20`,
        scope.pharmacyId,
        scope.branchId,
        q,
      );
    }
    return prisma.$queryRawUnsafe<unknown[]>(
      `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone, c.created_at,
        ${customerStatsSelect}
       FROM customers c
       WHERE c.pharmacy_id = $1
         AND (c.name ILIKE $2 OR c.phone ILIKE $2 OR c.father_name ILIKE $2 OR c.father_phone ILIKE $2)
       ORDER BY c.name LIMIT 20`,
      scope.pharmacyId,
      q,
    );
  },

  async getById(scope: BranchScope, id: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
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

    const customerStatsSelect = buildCustomerStatsSelect(scope);
    const statsWhere = scope.branchId
      ? `WHERE c.id = $1 AND c.pharmacy_id = $2 AND c.branch_id = $3`
      : `WHERE c.id = $1 AND c.pharmacy_id = $2`;
    const statsParams = scope.branchId
      ? [id, scope.pharmacyId, scope.branchId]
      : [id, scope.pharmacyId];

    const [stats] = await prisma.$queryRawUnsafe<CustomerStats[]>(
      `SELECT
        ${customerStatsSelect}
       FROM customers c
       ${statsWhere}
       GROUP BY c.id`,
      ...statsParams,
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

  async create(scope: BranchScope, data: CreateCustomerInput) {
    return prisma.customer.create({
      data: {
        pharmacyId: scope.pharmacyId,
        branchId: scope.branchId!,
        name: data.name,
        phone: data.phone ?? "",
        address: data.address ?? "",
        fatherName: data.fatherName ?? "",
        fatherPhone: data.fatherPhone ?? "",
      },
    });
  },

  async update(scope: BranchScope, id: string, data: CreateCustomerInput) {
    const existing = await prisma.customer.findFirst({
      where: { id, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    });
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

  async delete(scope: BranchScope, id: string, force = false) {
    const existing = await prisma.customer.findFirst({
      where: { id, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    });
    if (!existing) throw new NotFoundError("Customer");

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
