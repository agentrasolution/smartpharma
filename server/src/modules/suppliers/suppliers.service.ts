import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { CreateDistributorInput } from "./suppliers.schema";

export const suppliersService = {
  async list() {
    return prisma.distributor.findMany({
      orderBy: { name: "asc" },
      include: {
        company: { select: { name: true } },
        _count: { select: { products: true } },
      },
    });
  },

  async create(data: CreateDistributorInput) {
    return prisma.distributor.create({
      data: {
        name: data.name,
        phone: data.phone ?? "",
        contact: data.contact ?? "",
        address: data.address ?? "",
        companyId: data.companyId ?? null,
      },
    });
  },

  async update(id: string, data: CreateDistributorInput) {
    const existing = await prisma.distributor.findUnique({ where: { id } });
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

  async remove(id: string) {
    const existing = await prisma.distributor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Distributor");
    await prisma.distributor.delete({ where: { id } });
    return { success: true };
  },
};
