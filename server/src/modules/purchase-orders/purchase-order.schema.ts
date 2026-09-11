import { z } from "zod";

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
});

export const createPurchaseOrderDraftSchema = z.object({
  distributorId: z.string().min(1),
  items: z.array(purchaseOrderItemSchema).min(1),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const submitPurchaseOrderSchema = z.object({
  id: z.string().min(1),
});

export const approvePurchaseOrderSchema = z.object({
  id: z.string().min(1),
});

export const rejectPurchaseOrderSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1, "Rejection reason is required"),
});

export type CreatePurchaseOrderDraftInput = z.infer<typeof createPurchaseOrderDraftSchema>;