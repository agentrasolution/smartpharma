import { z } from "zod";

// ---------------------------------------------------------------------------
// Batch schemas
// ---------------------------------------------------------------------------

export const createBatchSchema = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().min(1).max(100),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  quantityInBaseUnits: z.number().int().positive(),
  costPricePerUnit: z.number().nonnegative(),
  salePricePerUnit: z.number().nonnegative(),
  gtin: z.string().max(50).optional(),
});

export const adjustBatchSchema = z.object({
  deltaUnits: z.number().int(),
  reasonCode: z.enum([
    "ADJUSTMENT",
    "EXPIRED_DISCARD",
    "RETURN_IN",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "DAMAGE",
  ]),
  referenceNumber: z.string().optional(),
});

export const recallBatchSchema = z.object({
  reason: z.string().min(3),
});

// ---------------------------------------------------------------------------
// Movement filter schema
// ---------------------------------------------------------------------------

export const movementFilterSchema = z.object({
  productId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  movementType: z
    .enum([
      "PURCHASE_RECEIPT",
      "SALE",
      "RETURN_IN",
      "RETURN_OUT",
      "ADJUSTMENT",
      "EXPIRED_DISCARD",
      "TRANSFER_IN",
      "TRANSFER_OUT",
    ])
    .optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type AdjustBatchInput = z.infer<typeof adjustBatchSchema>;
export type MovementFilterInput = z.infer<typeof movementFilterSchema>;
