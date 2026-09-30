import { z } from "zod";

// ---------------------------------------------------------------------------
// Drug master update schema (PATCH a product's drug master fields)
// ---------------------------------------------------------------------------

export const updateDrugMasterSchema = z.object({
  nameEn: z.string().min(1).max(255).optional(),
  nameAr: z.string().max(255).optional(),
  genericName: z.string().max(255).optional(),
  dosageForm: z
    .enum(["TABLET", "CAPSULE", "SYRUP", "INJECTION", "CREAM", "DROPS", "INHALER", "PATCH", "SUPPOSITORY", "OTHER"])
    .optional(),
  strength: z.string().max(100).optional(),
  regulatoryCode: z.string().max(100).optional(),
  sfdaCode: z.string().max(100).optional(),
  isRx: z.boolean().optional(),
  isControlled: z.boolean().optional(),
  isPriceRegulated: z.boolean().optional(),
  publicPrice: z.number().nonnegative().optional(),
  baseUnit: z.enum(["TABLET", "CAPSULE", "ML", "MG", "UNIT", "PIECE"]).optional(),
  packageUnit: z.enum(["BOX", "BOTTLE", "STRIP", "VIAL", "TUBE", "SACHET", "PIECE"]).optional(),
  unitsPerPack: z.number().int().positive().optional(),
});

// ---------------------------------------------------------------------------
// Bulk import schema (CSV / JSON upload)
// ---------------------------------------------------------------------------

export const bulkImportRowSchema = z.object({
  productId: z.string().uuid(),
  nameEn: z.string().max(255).optional(),
  nameAr: z.string().max(255).optional(),
  genericName: z.string().max(255).optional(),
  dosageForm: z.string().optional(),
  strength: z.string().max(100).optional(),
  regulatoryCode: z.string().max(100).optional(),
  sfdaCode: z.string().max(100).optional(),
  isRx: z.union([z.boolean(), z.string()]).optional().transform((v) =>
    typeof v === "string" ? v.toLowerCase() === "true" || v === "1" : v
  ),
  isControlled: z.union([z.boolean(), z.string()]).optional().transform((v) =>
    typeof v === "string" ? v.toLowerCase() === "true" || v === "1" : v
  ),
  isPriceRegulated: z.union([z.boolean(), z.string()]).optional().transform((v) =>
    typeof v === "string" ? v.toLowerCase() === "true" || v === "1" : v
  ),
  publicPrice: z.union([z.number(), z.string()]).optional().transform((v) =>
    typeof v === "string" ? parseFloat(v) : v
  ),
  baseUnit: z.string().optional(),
  packageUnit: z.string().optional(),
  unitsPerPack: z.union([z.number(), z.string()]).optional().transform((v) =>
    typeof v === "string" ? parseInt(v, 10) : v
  ),
});

export const bulkImportSchema = z.array(bulkImportRowSchema).min(1).max(5000);

export type UpdateDrugMasterInput = z.infer<typeof updateDrugMasterSchema>;
export type BulkImportRow = z.infer<typeof bulkImportRowSchema>;
