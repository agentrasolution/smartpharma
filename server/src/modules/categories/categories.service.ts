import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { CreateCategoryInput } from "./categories.schema";

export const categoriesService = {
  async list() {
    return prisma.category.findMany({
      orderBy: { name: "asc" },
    });
  },

  async create(data: CreateCategoryInput) {
    return prisma.category.create({
      data: { name: data.name },
    });
  },

  async update(id: string, data: CreateCategoryInput) {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Category");
    return prisma.category.update({
      where: { id },
      data: { name: data.name },
    });
  },

  async remove(id: string) {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Category");
    await prisma.category.delete({ where: { id } });
    return { success: true };
  },
};
