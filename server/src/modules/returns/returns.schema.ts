import { z } from "zod";

export const returnItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  refundAmount: z.number(),
});

export const createReturnSchema = z.object({
  saleId: z.string(),
  refundAmount: z.number(),
  reason: z.string().optional().default(""),
  items: z.array(returnItemSchema).min(1),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
