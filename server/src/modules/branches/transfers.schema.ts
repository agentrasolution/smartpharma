import { z } from "zod";

export const createTransferItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  sourceBatchId: z.string().optional(),
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

export const createTransferSchema = z.object({
  sourceBranchId: z.string().min(1, "Source branch ID is required"),
  destinationBranchId: z.string().min(1, "Destination branch ID is required"),
  notes: z.string().optional().default(""),
  sendImmediately: z.boolean().optional().default(false),
  items: z.array(createTransferItemSchema).min(1, "At least one item must be transferred"),
});

export const updateTransferStatusSchema = z.object({
  action: z.enum(["SEND", "RECEIVE", "REJECT", "CANCEL"]),
  rejectionReason: z.string().optional(),
});

export const branchPriceOverrideSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  salePrice: z.number().min(0, "Sale price cannot be negative"),
  reason: z.string().optional().default(""),
});

export const crossBranchStockQuerySchema = z.object({
  productId: z.string().optional(),
  barcode: z.string().optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateTransferItemInput = z.infer<typeof createTransferItemSchema>;
export type UpdateTransferStatusInput = z.infer<typeof updateTransferStatusSchema>;
export type BranchPriceOverrideInput = z.infer<typeof branchPriceOverrideSchema>;
export type CrossBranchStockQuery = z.infer<typeof crossBranchStockQuerySchema>;
