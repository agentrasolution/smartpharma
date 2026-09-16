import { prisma } from "../../services/prisma";
import type { Prisma } from "../../generated/prisma/client";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import type { CreateProductInput } from "./medicines.schema";
import type { BranchScope } from "../../middleware/auth";

function branchWhere(scope: BranchScope): Prisma.ProductWhereInput {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

export const medicinesService = {
  async list(
    scope: BranchScope,
    opts?: { includeArchived?: boolean; page?: number; pageSize?: number; search?: string },
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(Math.max(1, opts?.pageSize ?? 100), 1000);
    const where: Prisma.ProductWhereInput = {
      ...branchWhere(scope),
      ...(opts?.includeArchived ? {} : { active: 1 }),
    };
    const q = opts?.search?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        include: { prices: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    return { data, total, page, pageSize };
  },

  async search(scope: BranchScope, query: string) {
    const q = `%${query}%`;
    const rows = scope.branchId
      ? await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM products
           WHERE pharmacy_id = $1 AND branch_id = $2 AND active = 1
             AND (barcode ILIKE $3 OR name ILIKE $3)
           ORDER BY name LIMIT 50`,
          scope.pharmacyId,
          scope.branchId,
          q,
        )
      : await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM products
           WHERE pharmacy_id = $1 AND active = 1
             AND (barcode ILIKE $2 OR name ILIKE $2)
           ORDER BY name LIMIT 50`,
          scope.pharmacyId,
          q,
        );
    return rows;
  },

  async getByBarcode(scope: BranchScope, barcode: string) {
    return prisma.product.findFirst({
      where: { barcode, ...branchWhere(scope) },
      include: { prices: true },
    });
  },

  async getById(scope: BranchScope, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, ...branchWhere(scope) },
      include: { prices: true },
    });
    if (!product) throw new NotFoundError("Product");
    return product;
  },

  async create(scope: BranchScope, data: CreateProductInput & { branchId?: string }) {
    // A branch operator always creates into their own branch. A cross-branch
    // admin may target a specific branch; falls back to the first active one.
    const targetBranchId =
      scope.branchId ?? data.branchId ?? (await firstBranchId(scope.pharmacyId));
    if (!targetBranchId) throw new BadRequestError("No branch available to add the product to");
    await assertBranchInPharmacy(scope.pharmacyId, targetBranchId);
    if (scope.branchId && data.branchId && data.branchId !== scope.branchId) {
      throw new BadRequestError("Products can only be added to your own branch");
    }

    const clash = await prisma.product.findFirst({
      where: { branchId: targetBranchId, barcode: data.barcode },
    });
    if (clash) throw new BadRequestError(`A product with barcode ${data.barcode} already exists in this branch`);

    const salePrice = data.salePrice && data.salePrice > 0
      ? data.salePrice
      : Math.round(data.purchasePrice * (1 + (data.markupPercent ?? 20) / 100));

    const pricesData = data.prices && data.prices.length > 0
      ? data.prices.map((p) => ({
          label: p.label ?? "Standard",
          purchasePrice: p.purchasePrice,
          salePrice: p.salePrice && p.salePrice > 0
            ? p.salePrice
            : Math.round(p.purchasePrice * (1 + (data.markupPercent ?? 20) / 100)),
        }))
      : [];

    return prisma.product.create({
      data: {
        pharmacyId: scope.pharmacyId,
        branchId: targetBranchId,
        barcode: data.barcode,
        name: data.name,
        company: data.company ?? "",
        category: data.category ?? "",
        location: data.location ?? "",
        distributorId: data.distributorId ?? null,
        salePrice,
        purchasePrice: data.purchasePrice,
        markupPercent: data.markupPercent ?? 20,
        stockQty: data.stockQty ?? 0,
        expiry: data.expiry ?? null,
        packSize: data.packSize ?? 1,
        prices: { createMany: { data: pricesData } },
        barcodeLink: {
          connectOrCreate: {
            where: { code: data.barcode },
            create: { code: data.barcode, pharmacyId: scope.pharmacyId },
          },
        },
      },
      include: { prices: true },
    });
  },

  async update(scope: BranchScope, id: string, data: CreateProductInput) {
    const old = await prisma.product.findFirst({ where: { id, ...branchWhere(scope) } });
    if (!old) throw new NotFoundError("Product");

    const clash = await prisma.product.findFirst({
      where: { branchId: old.branchId, barcode: data.barcode, id: { not: id } },
    });
    if (clash) throw new BadRequestError(`A product with barcode ${data.barcode} already exists in this branch`);

    const salePrice = data.salePrice && data.salePrice > 0
      ? data.salePrice
      : Math.round(data.purchasePrice * (1 + (data.markupPercent ?? old.markupPercent) / 100));

    const updateData: Record<string, unknown> = {
      barcode: data.barcode,
      name: data.name,
      company: data.company ?? "",
      category: data.category ?? "",
      location: data.location ?? "",
      distributorId: data.distributorId ?? null,
      salePrice,
      purchasePrice: data.purchasePrice,
      markupPercent: data.markupPercent ?? old.markupPercent,
      stockQty: data.stockQty ?? 0,
      expiry: data.expiry ?? null,
      packSize: data.packSize ?? old.packSize,
    };

    if (data.prices) {
      const pricesData = data.prices.map((p) => ({
        label: p.label ?? "Standard",
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice && p.salePrice > 0
          ? p.salePrice
          : Math.round(p.purchasePrice * (1 + (data.markupPercent ?? old.markupPercent) / 100)),
      }));

      await prisma.productPrice.deleteMany({ where: { productId: id } });
      updateData.prices = { createMany: { data: pricesData } };
    }

    updateData.barcodeLink = {
      connectOrCreate: {
        where: { code: data.barcode },
        create: { code: data.barcode, pharmacyId: scope.pharmacyId },
      },
    };

    return prisma.product.update({
      where: { id },
      data: updateData as any,
      include: { prices: true },
    });
  },

  async archive(scope: BranchScope, id: string) {
    const product = await prisma.product.findFirst({ where: { id, ...branchWhere(scope) } });
    if (!product) throw new NotFoundError("Product");
    return prisma.product.update({ where: { id }, data: { active: 0 } });
  },

  async restore(scope: BranchScope, id: string) {
    const product = await prisma.product.findFirst({ where: { id, ...branchWhere(scope) } });
    if (!product) throw new NotFoundError("Product");
    return prisma.product.update({ where: { id }, data: { active: 1 } });
  },

  /**
   * Copies the entire active product catalogue (with price tiers) from one
   * branch into another within the same pharmacy. Products whose barcode
   * already exists in the target branch are skipped.
   */
  async copyCatalog(
    scope: BranchScope,
    fromBranchId: string,
    toBranchId: string,
  ) {
    if (scope.branchId) {
      throw new BadRequestError("Only a cross-branch administrator can copy a catalogue");
    }
    await assertBranchInPharmacy(scope.pharmacyId, fromBranchId);
    await assertBranchInPharmacy(scope.pharmacyId, toBranchId);
    if (fromBranchId === toBranchId) throw new BadRequestError("Source and target branches are the same");

    const source = await prisma.product.findMany({
      where: { pharmacyId: scope.pharmacyId, branchId: fromBranchId, active: 1 },
      include: { prices: true },
    });

    const target = await prisma.product.findMany({
      where: { pharmacyId: scope.pharmacyId, branchId: toBranchId },
      select: { barcode: true },
    });
    const existing = new Set(target.map((p) => p.barcode));

    let copied = 0;
    let skipped = 0;
    for (const product of source) {
      if (existing.has(product.barcode)) {
        skipped++;
        continue;
      }
      await prisma.product.create({
        data: {
          pharmacyId: scope.pharmacyId,
          branchId: toBranchId,
          barcode: product.barcode,
          name: product.name,
          company: product.company,
          category: product.category,
          location: product.location,
          distributorId: product.distributorId,
          salePrice: product.salePrice,
          purchasePrice: product.purchasePrice,
          markupPercent: product.markupPercent,
          stockQty: 0,
          expiry: product.expiry,
          packSize: product.packSize,
          active: product.active,
          prices: {
            createMany: {
              data: product.prices.map((p) => ({
                label: p.label,
                purchasePrice: p.purchasePrice,
                salePrice: p.salePrice,
              })),
            },
          },
        },
      });
      existing.add(product.barcode);
      copied++;
    }

    return { copied, skipped };
  },
};

async function firstBranchId(pharmacyId: string): Promise<string | null> {
  const branch = await prisma.branch.findFirst({
    where: { pharmacyId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return branch?.id ?? null;
}

async function assertBranchInPharmacy(pharmacyId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, pharmacyId } });
  if (!branch) throw new BadRequestError("Branch does not belong to this pharmacy");
}