import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { CreateCompanyInput } from "./companies.schema";

type PharmacyScope = { pharmacyId: string };

export const companiesService = {
  async list(scope: PharmacyScope) {
    return prisma.company.findMany({
      where: { pharmacyId: scope.pharmacyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { distributors: true } } },
    });
  },

  async create(scope: PharmacyScope, data: CreateCompanyInput) {
    return prisma.company.create({
      data: {
        pharmacyId: scope.pharmacyId,
        name: data.name,
        phone: data.phone ?? "",
        contact: data.contact ?? "",
        address: data.address ?? "",
        secondNumber: data.second_number ?? "",
      },
    });
  },

  async update(scope: PharmacyScope, id: string, data: CreateCompanyInput) {
    const existing = await prisma.company.findFirst({ where: { id, pharmacyId: scope.pharmacyId } });
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

  async remove(scope: PharmacyScope, id: string) {
    const existing = await prisma.company.findFirst({ where: { id, pharmacyId: scope.pharmacyId } });
    if (!existing) throw new NotFoundError("Company");
    await prisma.company.delete({ where: { id } });
    return { success: true };
  },
};
