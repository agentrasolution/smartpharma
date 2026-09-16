import { z } from "zod";

export const priceTierSchema = z.object({
  label: z.string().optional().default("Standard"),
  purchasePrice: z.number(),
  salePrice: z.number().optional(),
});

export const createProductSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  company: z.string().optional().default(""),
  category: z.string().optional().default(""),
  location: z.string().optional().default(""),
  distributorId: z.string().optional(),
  salePrice: z.number().optional(),
  purchasePrice: z.number(),
  markupPercent: z.number().optional().default(20),
  stockQty: z.number().int().optional().default(0),
  expiry: z.string().optional(),
  packSize: z
    .preprocess(
      (v) => {
        if (v == null || String(v).trim() === "") return undefined;
        const n = Number(String(v).replace(/[^\d-]/g, ""));
        return Number.isFinite(n) ? n : undefined;
      },
      z.number().int().min(0).optional().default(1)
    ),
  prices: z.array(priceTierSchema).optional(),
  branchId: z.string().optional(),
});

export const updateProductSchema = createProductSchema;

export const copyCatalogSchema = z.object({
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
