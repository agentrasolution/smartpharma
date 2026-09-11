import { z } from "zod";

export const createStockSchema = z.object({
  productId: z.string(),
  distributorId: z.string().optional(),
  companyId: z.string().optional(),
  invoiceNumber: z.string().optional().default(""),
  quantity: z.number().int().positive(),
  expiry: z.string().optional(),
});

export const updateStockSchema = z.object({
  quantity: z.number().int().min(0),
  expiry: z.string().optional(),
  companyId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  distributorId: z.string().optional(),
});

export type CreateStockInput = z.infer<typeof createStockSchema>;
