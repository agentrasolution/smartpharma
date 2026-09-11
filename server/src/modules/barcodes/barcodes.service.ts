import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";

export const barcodesService = {
  async list() {
    return prisma.barcode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { name: true, active: true },
        },
      },
    });
  },

  async create(code: string) {
    const existing = await prisma.barcode.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestError("Barcode already exists");
    }
    return prisma.barcode.create({
      data: { code },
      include: { product: { select: { name: true, active: true } } },
    });
  },

  async remove(id: string) {
    const barcode = await prisma.barcode.findUnique({ where: { id } });
    if (!barcode) throw new NotFoundError("Barcode");
    if (barcode.productId) {
      throw new BadRequestError("Cannot delete a barcode linked to a product");
    }
    await prisma.barcode.delete({ where: { id } });
    return { success: true };
  },
};
