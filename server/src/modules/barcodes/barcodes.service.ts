import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";

type PharmacyScope = { pharmacyId: string };

export const barcodesService = {
  async list(scope: PharmacyScope) {
    return prisma.barcode.findMany({
      where: { pharmacyId: scope.pharmacyId },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { name: true, active: true },
        },
      },
    });
  },

  async create(scope: PharmacyScope, code: string) {
    const existing = await prisma.barcode.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestError("Barcode already exists");
    }
    return prisma.barcode.create({
      data: { code, pharmacyId: scope.pharmacyId },
      include: { product: { select: { name: true, active: true } } },
    });
  },

  async remove(scope: PharmacyScope, id: string) {
    const barcode = await prisma.barcode.findFirst({ where: { id, pharmacyId: scope.pharmacyId } });
    if (!barcode) throw new NotFoundError("Barcode");
    if (barcode.productId) {
      throw new BadRequestError("Cannot delete a barcode linked to a product");
    }
    await prisma.barcode.delete({ where: { id } });
    return { success: true };
  },
};
