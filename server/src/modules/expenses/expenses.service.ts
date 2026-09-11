import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { CreateExpenseInput } from "./expenses.schema";

export const expensesService = {
  async list() {
    return prisma.expense.findMany({ orderBy: { date: "desc" } });
  },

  async create(data: CreateExpenseInput) {
    return prisma.expense.create({
      data: {
        title: data.title,
        category: data.category,
        amount: data.amount,
        notes: data.notes ?? "",
        date: data.date,
      },
    });
  },

  async update(id: string, data: CreateExpenseInput) {
    const existing = await prisma.expense.findUnique({ where: { id } });
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

  async delete(id: string) {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Expense");
    await prisma.expense.delete({ where: { id } });
    return { success: true };
  },
};
