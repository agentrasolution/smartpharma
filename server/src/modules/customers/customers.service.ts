import { prisma } from "../../services/prisma";
import { NotFoundError, BadRequestError } from "../../utils/errors";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateChronicMedicationInput,
  UpdateChronicMedicationInput,
  RecordRefillInput,
} from "./customers.schema";
import { Prisma } from "../../generated/prisma/client";
import type { BranchScope } from "../../middleware/auth";

interface CustomerStats {
  total_purchases: number;
  outstanding_arrear: number;
  last_purchase: string | null;
  active_chronic_meds: number;
}

function buildCustomerStatsSelect(scope: BranchScope): string {
  if (scope.branchId) {
    return `
      (SELECT COUNT(*)::int FROM sales s WHERE s.customer_id = c.id AND s.pharmacy_id = $1 AND s.branch_id = $2) AS total_purchases,
      COALESCE((SELECT SUM(a.balance_due) FROM arrears a WHERE a.customer_id = c.id AND a.pharmacy_id = $1 AND a.branch_id = $2 AND a.status = 'pending'), 0) AS outstanding_arrear,
      (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.pharmacy_id = $1 AND s.branch_id = $2) AS last_purchase,
      (SELECT COUNT(*)::int FROM chronic_medications cm WHERE cm.customer_id = c.id AND cm.pharmacy_id = $1 AND cm.branch_id = $2 AND cm.status = 'ACTIVE') AS active_chronic_meds`;
  }
  return `
    (SELECT COUNT(*)::int FROM sales s WHERE s.customer_id = c.id AND s.pharmacy_id = $1) AS total_purchases,
    COALESCE((SELECT SUM(a.balance_due) FROM arrears a WHERE a.customer_id = c.id AND a.pharmacy_id = $1 AND a.status = 'pending'), 0) AS outstanding_arrear,
    (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.pharmacy_id = $1) AS last_purchase,
    (SELECT COUNT(*)::int FROM chronic_medications cm WHERE cm.customer_id = c.id AND cm.pharmacy_id = $1 AND cm.status = 'ACTIVE') AS active_chronic_meds`;
}

export const customersService = {
  async list(scope: BranchScope) {
    const customerStatsSelect = buildCustomerStatsSelect(scope);
    if (scope.branchId) {
      return prisma.$queryRawUnsafe<unknown[]>(
        `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone,
                c.national_id, c.date_of_birth, c.gender, c.blood_group, c.allergies,
                c.chronic_conditions, c.emergency_contact_name, c.emergency_contact_phone,
                c.credit_limit, c.allow_credit, c.notes, c.consent_given, c.consent_date,
                c.consent_notes, c.created_at, c.updated_at,
          ${customerStatsSelect}
         FROM customers c
         WHERE c.pharmacy_id = $1 AND c.branch_id = $2
         ORDER BY c.name ASC`,
        scope.pharmacyId,
        scope.branchId,
      );
    }
    return prisma.$queryRawUnsafe<unknown[]>(
      `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone,
              c.national_id, c.date_of_birth, c.gender, c.blood_group, c.allergies,
              c.chronic_conditions, c.emergency_contact_name, c.emergency_contact_phone,
              c.credit_limit, c.allow_credit, c.notes, c.consent_given, c.consent_date,
              c.consent_notes, c.created_at, c.updated_at,
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
        `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone,
                c.national_id, c.date_of_birth, c.gender, c.blood_group, c.allergies,
                c.chronic_conditions, c.emergency_contact_name, c.emergency_contact_phone,
                c.credit_limit, c.allow_credit, c.notes, c.consent_given, c.consent_date,
                c.consent_notes, c.created_at, c.updated_at,
          ${customerStatsSelect}
         FROM customers c
         WHERE c.pharmacy_id = $1 AND c.branch_id = $2
           AND (c.name ILIKE $3 OR c.phone ILIKE $3 OR c.father_name ILIKE $3 OR c.father_phone ILIKE $3 OR c.national_id ILIKE $3)
         ORDER BY c.name LIMIT 20`,
        scope.pharmacyId,
        scope.branchId,
        q,
      );
    }
    return prisma.$queryRawUnsafe<unknown[]>(
      `SELECT c.id, c.name, c.phone, c.address, c.father_name, c.father_phone,
              c.national_id, c.date_of_birth, c.gender, c.blood_group, c.allergies,
              c.chronic_conditions, c.emergency_contact_name, c.emergency_contact_phone,
              c.credit_limit, c.allow_credit, c.notes, c.consent_given, c.consent_date,
              c.consent_notes, c.created_at, c.updated_at,
        ${customerStatsSelect}
       FROM customers c
       WHERE c.pharmacy_id = $1
         AND (c.name ILIKE $2 OR c.phone ILIKE $2 OR c.father_name ILIKE $2 OR c.father_phone ILIKE $2 OR c.national_id ILIKE $2)
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
        chronicMedications: {
          orderBy: { nextRefillDate: "asc" },
          include: { product: true },
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
      national_id: customer.nationalId,
      date_of_birth: customer.dateOfBirth?.toISOString() ?? null,
      gender: customer.gender,
      blood_group: customer.bloodGroup,
      allergies: customer.allergies,
      chronic_conditions: customer.chronicConditions,
      emergency_contact_name: customer.emergencyContactName,
      emergency_contact_phone: customer.emergencyContactPhone,
      credit_limit: customer.creditLimit,
      allow_credit: customer.allowCredit,
      notes: customer.notes,
      consent_given: customer.consentGiven,
      consent_date: customer.consentDate?.toISOString() ?? null,
      consent_notes: customer.consentNotes,
      created_at: customer.createdAt.toISOString(),
      updated_at: customer.updatedAt.toISOString(),
      total_purchases: stats?.total_purchases ?? 0,
      outstanding_arrear: stats?.outstanding_arrear ?? 0,
      last_purchase: stats?.last_purchase ?? null,
      active_chronic_meds: stats?.active_chronic_meds ?? 0,
      purchases: customer.sales.map((s) => ({
        id: s.id,
        customer_id: s.customerId ?? undefined,
        subtotal: s.subtotal,
        discount: s.discount,
        total: s.total,
        amount_paid: s.amountPaid,
        change: s.change,
        status: s.status,
        payment_method: s.paymentMethod,
        cash_amount: s.cashAmount,
        card_amount: s.cardAmount,
        credit_amount: s.creditAmount,
        prescription_number: s.prescriptionNumber,
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
          batch_number: i.batchNumber,
          expiry_date: i.expiryDate ? i.expiryDate.toISOString() : null,
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
      chronic_medications: customer.chronicMedications.map((m) => {
        const daysRemaining = Math.ceil(
          (m.nextRefillDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: m.id,
          customer_id: m.customerId,
          product_id: m.productId,
          product_name: m.product?.name ?? null,
          medication_name: m.medicationName,
          dosage: m.dosage,
          frequency: m.frequency,
          days_supply: m.daysSupply,
          last_dispensed_date: m.lastDispensedDate.toISOString(),
          next_refill_date: m.nextRefillDate.toISOString(),
          days_remaining: daysRemaining,
          reminder_active: m.reminderActive,
          status: m.status,
          notes: m.notes,
          last_contacted_at: m.lastContactedAt?.toISOString() ?? null,
          contact_notes: m.contactNotes,
          created_at: m.createdAt.toISOString(),
        };
      }),
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
        nationalId: data.nationalId ?? "",
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender ?? "",
        bloodGroup: data.bloodGroup ?? "",
        allergies: data.allergies ?? [],
        chronicConditions: data.chronicConditions ?? [],
        emergencyContactName: data.emergencyContactName ?? "",
        emergencyContactPhone: data.emergencyContactPhone ?? "",
        creditLimit: data.creditLimit ?? 0,
        allowCredit: data.allowCredit ?? true,
        notes: data.notes ?? "",
        consentGiven: data.consentGiven ?? false,
        consentDate: data.consentDate ? new Date(data.consentDate) : (data.consentGiven ? new Date() : null),
        consentNotes: data.consentNotes ?? "",
      },
    });
  },

  async update(scope: BranchScope, id: string, data: UpdateCustomerInput) {
    const existing = await prisma.customer.findFirst({
      where: { id, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    });
    if (!existing) throw new NotFoundError("Customer");

    return prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        fatherName: data.fatherName,
        fatherPhone: data.fatherPhone,
        nationalId: data.nationalId,
        dateOfBirth: data.dateOfBirth !== undefined ? (data.dateOfBirth ? new Date(data.dateOfBirth) : null) : undefined,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        allergies: data.allergies,
        chronicConditions: data.chronicConditions,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        creditLimit: data.creditLimit,
        allowCredit: data.allowCredit,
        notes: data.notes,
        consentGiven: data.consentGiven,
        consentDate: data.consentDate !== undefined ? (data.consentDate ? new Date(data.consentDate) : null) : undefined,
        consentNotes: data.consentNotes,
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
      await tx.chronicMedication.deleteMany({ where: { customerId: id } });
      await tx.customer.delete({ where: { id } });
      return { success: true };
    });
  },

  // -------------------------------------------------------------
  // Customer Statement & Running Arrears Ledger
  // -------------------------------------------------------------
  async getStatement(scope: BranchScope, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
      include: {
        sales: { orderBy: { createdAt: "asc" } },
        arrears: {
          orderBy: { createdAt: "asc" },
          include: { payments: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    if (!customer) throw new NotFoundError("Customer");

    type StatementEntry = {
      date: string;
      reference: string;
      description: string;
      type: "SALE_CASH_CARD" | "CREDIT_INVOICE" | "ARREAR_PAYMENT";
      debit: number; // amount billed/owed
      credit: number; // amount paid
      runningBalance: number;
    };

    const entries: StatementEntry[] = [];
    let runningBalance = 0;

    // Collect all credit entries from arrears
    for (const arr of customer.arrears) {
      // The credit creation entry
      const initialDue = arr.totalBill;
      runningBalance += initialDue;
      entries.push({
        date: arr.createdAt.toISOString(),
        reference: arr.saleId ?? arr.id,
        description: `Invoice on Credit (Bill: ${arr.totalBill})`,
        type: "CREDIT_INVOICE",
        debit: initialDue,
        credit: arr.amountPaid > 0 && arr.payments.length === 0 ? arr.amountPaid : 0,
        runningBalance,
      });

      // Payments made against this arrear
      for (const p of arr.payments) {
        runningBalance -= p.amount;
        entries.push({
          date: p.createdAt.toISOString(),
          reference: p.paymentSaleId ?? p.id,
          description: `Arrear Settlement Payment`,
          type: "ARREAR_PAYMENT",
          debit: 0,
          credit: p.amount,
          runningBalance,
        });
      }
    }

    // Sort entries chronologically
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Recompute exact running balance in chronological order
    let balance = 0;
    for (const entry of entries) {
      balance += (entry.debit - entry.credit);
      entry.runningBalance = Math.max(0, balance);
    }

    const totalDebit = entries.reduce((acc, e) => acc + e.debit, 0);
    const totalCredit = entries.reduce((acc, e) => acc + e.credit, 0);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        national_id: customer.nationalId,
        credit_limit: customer.creditLimit,
        allow_credit: customer.allowCredit,
      },
      summary: {
        total_billed: totalDebit,
        total_paid: totalCredit,
        current_balance: Math.max(0, balance),
      },
      entries,
    };
  },

  // -------------------------------------------------------------
  // Chronic Medications & Refill Reminders
  // -------------------------------------------------------------
  async addChronicMedication(scope: BranchScope, data: CreateChronicMedicationInput) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    });
    if (!customer) throw new NotFoundError("Customer");

    const daysSupply = data.daysSupply ?? 30;
    const lastDispensed = data.lastDispensedDate ? new Date(data.lastDispensedDate) : new Date();
    const nextRefill = data.nextRefillDate
      ? new Date(data.nextRefillDate)
      : new Date(lastDispensed.getTime() + daysSupply * 24 * 60 * 60 * 1000);

    return prisma.chronicMedication.create({
      data: {
        pharmacyId: scope.pharmacyId,
        branchId: scope.branchId!,
        customerId: data.customerId,
        productId: data.productId || null,
        medicationName: data.medicationName,
        dosage: data.dosage ?? "",
        frequency: data.frequency ?? "",
        daysSupply,
        lastDispensedDate: lastDispensed,
        nextRefillDate: nextRefill,
        reminderActive: data.reminderActive ?? true,
        notes: data.notes ?? "",
      },
      include: { product: true },
    });
  },

  async updateChronicMedication(scope: BranchScope, id: string, data: UpdateChronicMedicationInput) {
    const existing = await prisma.chronicMedication.findFirst({
      where: { id, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    });
    if (!existing) throw new NotFoundError("Chronic Medication");

    let nextRefill: Date | undefined = undefined;
    if (data.nextRefillDate) {
      nextRefill = new Date(data.nextRefillDate);
    } else if (data.daysSupply && data.daysSupply !== existing.daysSupply) {
      nextRefill = new Date(existing.lastDispensedDate.getTime() + data.daysSupply * 24 * 60 * 60 * 1000);
    }

    return prisma.chronicMedication.update({
      where: { id },
      data: {
        dosage: data.dosage,
        frequency: data.frequency,
        daysSupply: data.daysSupply,
        reminderActive: data.reminderActive,
        status: data.status,
        nextRefillDate: nextRefill,
        notes: data.notes,
      },
      include: { product: true },
    });
  },

  async deleteChronicMedication(scope: BranchScope, id: string) {
    const existing = await prisma.chronicMedication.findFirst({
      where: { id, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    });
    if (!existing) throw new NotFoundError("Chronic Medication");

    await prisma.chronicMedication.delete({ where: { id } });
    return { success: true };
  },

  async listChronicMedications(scope: BranchScope, customerId: string) {
    return prisma.chronicMedication.findMany({
      where: {
        customerId,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      orderBy: { nextRefillDate: "asc" },
      include: { product: true },
    });
  },

  async getRefillQueue(scope: BranchScope, filter?: "all" | "dueSoon" | "dueToday" | "overdue") {
    const meds = await prisma.chronicMedication.findMany({
      where: {
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        status: "ACTIVE",
        reminderActive: true,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            nationalId: true,
            fatherName: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            stockQty: true,
            salePrice: true,
            barcode: true,
          },
        },
      },
      orderBy: { nextRefillDate: "asc" },
    });

    const now = new Date();
    // Normalize today to midnight for pure day comparison
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const items = meds.map((m) => {
      const refillMidnight = new Date(
        m.nextRefillDate.getFullYear(),
        m.nextRefillDate.getMonth(),
        m.nextRefillDate.getDate()
      );
      const diffMs = refillMidnight.getTime() - todayMidnight.getTime();
      const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

      let urgency: "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "UPCOMING";
      if (daysRemaining < 0) {
        urgency = "OVERDUE";
      } else if (daysRemaining === 0) {
        urgency = "DUE_TODAY";
      } else if (daysRemaining <= 7) {
        urgency = "DUE_SOON";
      } else {
        urgency = "UPCOMING";
      }

      return {
        id: m.id,
        customer_id: m.customerId,
        customer_name: m.customer.name,
        customer_phone: m.customer.phone,
        customer_national_id: m.customer.nationalId,
        product_id: m.productId,
        product_name: m.product?.name ?? null,
        product_stock: m.product?.stockQty ?? 0,
        product_sale_price: m.product?.salePrice ?? 0,
        medication_name: m.medicationName,
        dosage: m.dosage,
        frequency: m.frequency,
        days_supply: m.daysSupply,
        last_dispensed_date: m.lastDispensedDate.toISOString(),
        next_refill_date: m.nextRefillDate.toISOString(),
        days_remaining: daysRemaining,
        urgency,
        notes: m.notes,
        last_contacted_at: m.lastContactedAt ? m.lastContactedAt.toISOString() : null,
        contact_notes: m.contactNotes,
      };
    });

    if (filter === "overdue") {
      return items.filter((i) => i.urgency === "OVERDUE");
    }
    if (filter === "dueToday") {
      return items.filter((i) => i.urgency === "DUE_TODAY");
    }
    if (filter === "dueSoon") {
      return items.filter((i) => i.urgency === "DUE_SOON");
    }
    // "all" returns dueSoon, dueToday, and overdue (anything within 14 days or overdue)
    return items.filter((i) => i.days_remaining <= 14);
  },

  async recordContact(scope: BranchScope, id: string, notes: string) {
    const existing = await prisma.chronicMedication.findFirst({
      where: { id, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    });
    if (!existing) throw new NotFoundError("Chronic Medication");

    return prisma.chronicMedication.update({
      where: { id },
      data: {
        lastContactedAt: new Date(),
        contactNotes: notes,
      },
      include: { product: true },
    });
  },

  async recordRefill(scope: BranchScope, id: string, data: RecordRefillInput) {
    const existing = await prisma.chronicMedication.findFirst({
      where: { id, pharmacyId: scope.pharmacyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    });
    if (!existing) throw new NotFoundError("Chronic Medication");

    const dispensedDate = data.dispensedDate ? new Date(data.dispensedDate) : new Date();
    const daysSupply = data.daysSupply ?? existing.daysSupply;
    const nextRefill = new Date(dispensedDate.getTime() + daysSupply * 24 * 60 * 60 * 1000);

    return prisma.chronicMedication.update({
      where: { id },
      data: {
        lastDispensedDate: dispensedDate,
        nextRefillDate: nextRefill,
        daysSupply,
        notes: data.notes ? `${existing.notes ? `${existing.notes}\n` : ""}[Refill ${dispensedDate.toLocaleDateString()}]: ${data.notes}` : existing.notes,
      },
      include: { product: true },
    });
  },
};
