import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { CreateCompanyInput } from "./companies.schema";

export const companiesService = {
  async list() {
    return prisma.company.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { distributors: true } } },
    });
  },

  async create(data: CreateCompanyInput) {
    return prisma.company.create({
      data: {
        name: data.name,
        phone: data.phone ?? "",
        contact: data.contact ?? "",
        address: data.address ?? "",
        secondNumber: data.second_number ?? "",
      },
    });
  },

  async update(id: string, data: CreateCompanyInput) {
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Company");
    return prisma.company.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone ?? "",
        contact: data.contact ?? "",
        address: data.address ?? "",
        secondNumber: data.second_number ?? "",
      },
    });
  },

  async remove(id: string) {
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Company");
    await prisma.company.delete({ where: { id } });
    return { success: true };
  },
};
