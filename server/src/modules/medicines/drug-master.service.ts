/**
 * drug-master.service.ts
 * Pillar B – Drug Master Data CRUD
 *
 * Manages the drug master fields added to the Product model:
 * nameEn, nameAr, genericName, dosageForm, strength, sfdaCode,
 * isRx, isControlled, isPriceRegulated, publicPrice,
 * baseUnit, packageUnit, unitsPerPack.
 *
 * All queries are scoped to the pharmacy (multi-tenant safe).
 */

import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { BranchScope } from "../../middleware/auth";
import type { UpdateDrugMasterInput, BulkImportRow } from "./drug-master.schema";

// Drug master select fields (used in all queries to avoid over-fetching)
const DRUG_MASTER_SELECT = {
  id: true,
  name: true,
  nameEn: true,
  nameAr: true,
  genericName: true,
  dosageForm: true,
  strength: true,
  sfdaCode: true,
  isRx: true,
  isControlled: true,
  isPriceRegulated: true,
  publicPrice: true,
  baseUnit: true,
  packageUnit: true,
  unitsPerPack: true,
  packSize: true,
  barcode: true,
  category: true,
  active: true,
} as const;

export interface DrugSearchParams {
  q?: string;          // free-text (name, genericName, sfdaCode, barcode)
  isRx?: boolean;
  isControlled?: boolean;
  dosageForm?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export const drugMasterService = {
  /**
   * Search drug master records with pagination.
   * Searches: name, nameEn, nameAr, genericName, sfdaCode.
   */
  async search(scope: BranchScope, params: DrugSearchParams = {}) {
    const { q, isRx, isControlled, dosageForm, category, page = 1, limit = 50 } = params;

    const where: Record<string, unknown> = {
      pharmacyId: scope.pharmacyId,
      active: 1,
    };

    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { nameEn: { contains: term, mode: "insensitive" } },
        { nameAr: { contains: term, mode: "insensitive" } },
        { genericName: { contains: term, mode: "insensitive" } },
        { sfdaCode: { contains: term, mode: "insensitive" } },
        { barcode: { contains: term, mode: "insensitive" } },
      ];
    }

    if (isRx !== undefined) where.isRx = isRx;
    if (isControlled !== undefined) where.isControlled = isControlled;
    if (dosageForm) where.dosageForm = dosageForm;
    if (category) where.category = { contains: category, mode: "insensitive" };

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: DRUG_MASTER_SELECT,
        orderBy: [{ nameEn: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },

  /**
   * Get drug master data for a single product.
   */
  async getById(scope: BranchScope, productId: string) {
    const product = await prisma.product.findFirst({
      where: { id: productId, pharmacyId: scope.pharmacyId, active: 1 },
      select: {
        ...DRUG_MASTER_SELECT,
        batches: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            quantityInBaseUnits: true,
            status: true,
          },
          orderBy: { expiryDate: "asc" },
        },
      },
    });
    if (!product) throw new NotFoundError("Product");
    return product;
  },

  /**
   * Update drug master fields for a single product.
   */
  async update(scope: BranchScope, productId: string, data: UpdateDrugMasterInput) {
    const product = await prisma.product.findFirst({
      where: { id: productId, pharmacyId: scope.pharmacyId },
    });
    if (!product) throw new NotFoundError("Product");

    return prisma.product.update({
      where: { id: productId },
      data: {
        ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.genericName !== undefined && { genericName: data.genericName }),
        ...(data.dosageForm !== undefined && { dosageForm: data.dosageForm }),
        ...(data.strength !== undefined && { strength: data.strength }),
        ...((data.regulatoryCode !== undefined || data.sfdaCode !== undefined) && {
          sfdaCode: data.regulatoryCode ?? data.sfdaCode,
        }),
        ...(data.isRx !== undefined && { isRx: data.isRx }),
        ...(data.isControlled !== undefined && { isControlled: data.isControlled }),
        ...(data.isPriceRegulated !== undefined && { isPriceRegulated: data.isPriceRegulated }),
        ...(data.publicPrice !== undefined && { publicPrice: data.publicPrice }),
        ...(data.baseUnit !== undefined && { baseUnit: data.baseUnit }),
        ...(data.packageUnit !== undefined && { packageUnit: data.packageUnit }),
        ...(data.unitsPerPack !== undefined && { unitsPerPack: data.unitsPerPack }),
      },
      select: DRUG_MASTER_SELECT,
    });
  },

  /**
   * Bulk-import / bulk-update drug master data from a JSON array.
   * Processes in batches of 100 to avoid transaction size limits.
   * Returns per-row success/failure so the caller can show a diff report.
   */
  async bulkImport(scope: BranchScope, rows: BulkImportRow[]) {
    const CHUNK = 100;
    const results: Array<{ productId: string; status: "ok" | "not_found" | "error"; error?: string }> = [];

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);

      await prisma.$transaction(async (tx) => {
        for (const row of chunk) {
          try {
            const exists = await tx.product.findFirst({
              where: { id: row.productId, pharmacyId: scope.pharmacyId },
              select: { id: true },
            });

            if (!exists) {
              results.push({ productId: row.productId, status: "not_found" });
              continue;
            }

            await tx.product.update({
              where: { id: row.productId },
              data: {
                ...(row.nameEn !== undefined && { nameEn: row.nameEn }),
                ...(row.nameAr !== undefined && { nameAr: row.nameAr }),
                ...(row.genericName !== undefined && { genericName: row.genericName }),
                ...(row.dosageForm !== undefined && { dosageForm: row.dosageForm }),
                ...(row.strength !== undefined && { strength: row.strength }),
                ...((row.regulatoryCode !== undefined || row.sfdaCode !== undefined) && {
                  sfdaCode: (row.regulatoryCode as string | undefined) ?? (row.sfdaCode as string | undefined),
                }),
                ...(row.isRx !== undefined && { isRx: Boolean(row.isRx) }),
                ...(row.isControlled !== undefined && { isControlled: Boolean(row.isControlled) }),
                ...(row.isPriceRegulated !== undefined && { isPriceRegulated: Boolean(row.isPriceRegulated) }),
                ...(row.publicPrice !== undefined && !isNaN(Number(row.publicPrice)) && { publicPrice: Number(row.publicPrice) }),
                ...(row.baseUnit !== undefined && { baseUnit: row.baseUnit }),
                ...(row.packageUnit !== undefined && { packageUnit: row.packageUnit }),
                ...(row.unitsPerPack !== undefined && !isNaN(Number(row.unitsPerPack)) && { unitsPerPack: Number(row.unitsPerPack) }),
              },
            });

            results.push({ productId: row.productId, status: "ok" });
          } catch (err: unknown) {
            results.push({
              productId: row.productId,
              status: "error",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      });
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const notFound = results.filter((r) => r.status === "not_found").length;
    const errors = results.filter((r) => r.status === "error").length;

    return { summary: { total: rows.length, ok, notFound, errors }, results };
  },

  /**
   * Get all distinct dosage forms in use for this pharmacy (for filter dropdowns).
   */
  async listDosageForms(scope: BranchScope) {
    const products = await prisma.product.findMany({
      where: { pharmacyId: scope.pharmacyId, active: 1 },
      select: { dosageForm: true },
      distinct: ["dosageForm"],
      orderBy: { dosageForm: "asc" },
    });
    return products.map((p) => p.dosageForm).filter(Boolean);
  },

  /**
   * Get all products missing drug master data (nameEn empty or sfdaCode null).
   * Useful for showing a "data quality" list.
   */
  async listIncomplete(scope: BranchScope, page = 1, limit = 100) {
    const where = {
      pharmacyId: scope.pharmacyId,
      active: 1,
      OR: [
        { nameEn: "" },
        { sfdaCode: null },
        { genericName: "" },
      ],
    };

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: DRUG_MASTER_SELECT,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  },
};
