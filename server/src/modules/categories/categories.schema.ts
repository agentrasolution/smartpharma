import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  vatRate: z.number().min(0, "VAT rate must be >= 0").max(100, "VAT rate must be <= 100").optional().default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  vatRate: z.number().min(0).max(100).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

