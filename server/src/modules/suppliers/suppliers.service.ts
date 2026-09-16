import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { CreateDistributorInput } from "./suppliers.schema";

type PharmacyScope = { pharmacyId: string };

export const suppliersService = {
  async list(scope: PharmacyScope) {
    return prisma.distributor.findMany({
      where: { pharmacyId: scope.pharmacyId },
      orderBy: { name: "asc" },
      include: {
        company: { select: { name: true } },
        _count: { select: { products: true } },
      },
    });
  },

  async create(scope: PharmacyScope, data: CreateDistributorInput) {
    return prisma.distributor.create({
      data: {
        pharmacyId: scope.pharmacyId,
        name: data.name,
        phone: data.phone ?? "",
        contact: data.contact ?? "",
        address: data.address ?? "",
        companyId: data.companyId ?? null,
      },
    });
  },

  async update(scope: PharmacyScope, id: string, data: CreateDistributorInput) {
    const existing = await prisma.distributor.findFirst({ where: { id, pharmacyId: scope.pharmacyId } });
    if (!existing) throw new NotFoundError("Distributor");
    return prisma.distributor.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone ?? "",
        contact: data.contact ?? "",
        address: data.address ?? "",
        companyId: data.companyId ?? null,
      },
    });
  },

  async remove(scope: PharmacyScope, id: string) {
    const existing = await prisma.distributor.findFirst({ where: { id, pharmacyId: scope.pharmacyId } });
    if (!existing) throw new NotFoundError("Distributor");
    await prisma.distributor.delete({ where: { id } });
    return { success: true };
  },
};
