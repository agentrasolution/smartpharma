import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { CreateExpenseInput } from "./expenses.schema";
import type { BranchScope } from "../../middleware/auth";

function branchWhere(scope: BranchScope) {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

export const expensesService = {
  async list(scope: BranchScope) {
    return prisma.expense.findMany({
      where: branchWhere(scope),
      orderBy: { date: "desc" },
    });
  },

  async create(scope: BranchScope, data: CreateExpenseInput) {
    return prisma.expense.create({
      data: {
        pharmacyId: scope.pharmacyId,
        branchId: scope.branchId!,
        title: data.title,
        category: data.category,
        amount: data.amount,
        notes: data.notes ?? "",
        date: data.date,
      },
    });
  },

  async update(scope: BranchScope, id: string, data: CreateExpenseInput) {
    const existing = await prisma.expense.findFirst({ where: { id, ...branchWhere(scope) } });
    if (!existing) throw new NotFoundError("Expense");
    return prisma.expense.update({
      where: { id },
      data: {
        title: data.title,
        category: data.category,
        amount: data.amount,
        notes: data.notes ?? "",
        date: data.date,
      },
    });
  },

  async delete(scope: BranchScope, id: string) {
    const existing = await prisma.expense.findFirst({ where: { id, ...branchWhere(scope) } });
    if (!existing) throw new NotFoundError("Expense");
    await prisma.expense.delete({ where: { id } });
    return { success: true };
  },
};
