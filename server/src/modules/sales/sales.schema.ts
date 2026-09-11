import { z } from "zod";

export const saleItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  barcode: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number(),
  subtotal: z.number(),
});

export const createSaleSchema = z.object({
  customerId: z.string().optional(),
  subtotal: z.number(),
  discount: z.number().default(0),
  total: z.number(),
  amountPaid: z.number(),
  items: z.array(saleItemSchema).min(1),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
