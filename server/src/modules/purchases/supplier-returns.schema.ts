import { z } from "zod";

export const ReturnReasonEnum = z.enum([
  "NEAR_EXPIRY",
  "DAMAGED",
  "RECALLED",
  "EXCESS_STOCK",
  "EXPIRED",
  "WRONG_ITEM",
  "OTHER",
]);

export const SupplierReturnItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  batchId: z.string().optional().nullable(),
  batchNumber: z.string().min(1, "Batch number is required"),
  expiryDate: z.string().optional().nullable(),
  quantityPacks: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitsPerPack: z.coerce.number().int().min(1).default(1),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative"),
  reason: z.string().optional().default(""),
});

export const CreateSupplierReturnSchema = z.object({
  distributorId: z.string().min(1, "Distributor ID is required"),
  invoiceId: z.string().optional().nullable(),
  reason: ReturnReasonEnum.default("NEAR_EXPIRY"),
  notes: z.string().optional().default(""),
  autoApprove: z.boolean().optional().default(false),
  creditNoteNumber: z.string().optional().nullable(),
  items: z.array(SupplierReturnItemSchema).min(1, "At least one item must be returned"),
});

export type CreateSupplierReturnInput = z.infer<typeof CreateSupplierReturnSchema>;

export const ApproveSupplierReturnSchema = z.object({
  creditNoteNumber: z.string().optional().nullable(),
  creditNoteDate: z.string().optional().nullable(),
  notes: z.string().optional().default(""),
});

export type ApproveSupplierReturnInput = z.infer<typeof ApproveSupplierReturnSchema>;

export const RejectSupplierReturnSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export type RejectSupplierReturnInput = z.infer<typeof RejectSupplierReturnSchema>;

export const ListSupplierReturnsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
  distributorId: z.string().optional(),
  branchId: z.string().optional(),
  reason: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ListSupplierReturnsQuery = z.infer<typeof ListSupplierReturnsQuerySchema>;
