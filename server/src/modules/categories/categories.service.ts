import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { CreateCategoryInput } from "./categories.schema";

type PharmacyScope = { pharmacyId: string };

export const categoriesService = {
  async list(scope: PharmacyScope) {
    return prisma.category.findMany({
      where: { pharmacyId: scope.pharmacyId },
      orderBy: { name: "asc" },
    });
  },

  async create(scope: PharmacyScope, data: CreateCategoryInput) {
    return prisma.category.create({
      data: {
        pharmacyId: scope.pharmacyId,
        name: data.name,
        vatRate: data.vatRate ?? 0,
      },
    });
  },

  async update(scope: PharmacyScope, id: string, data: Partial<CreateCategoryInput>) {
    const existing = await prisma.category.findFirst({ where: { id, pharmacyId: scope.pharmacyId } });
    if (!existing) throw new NotFoundError("Category");
    return prisma.category.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.vatRate !== undefined ? { vatRate: data.vatRate } : {}),
      },
    });
  },

  async remove(scope: PharmacyScope, id: string) {
    const existing = await prisma.category.findFirst({ where: { id, pharmacyId: scope.pharmacyId } });
    if (!existing) throw new NotFoundError("Category");
    await prisma.category.delete({ where: { id } });
    return { success: true };
  },
};
