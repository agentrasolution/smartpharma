import { z } from "zod";

// Legacy single-item purchase schema
export const createStockSchema = z.object({
  productId: z.string(),
  distributorId: z.string().optional(),
  companyId: z.string().optional(),
  invoiceNumber: z.string().optional().default(""),
  batchNumber: z.string().optional(), // explicit batch/lot number; falls back to invoiceNumber
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

// Direct Supplier Invoice (Header + Multi-line items)
export const purchaseInvoiceItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  batchNumber: z.string().min(1, "Batch number is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  quantityPacks: z.number().int().positive("Quantity must be at least 1 pack"),
  unitsPerPack: z.number().int().positive().optional(),
  unitCost: z.number().min(0, "Unit cost must be non-negative"),
  salePrice: z.number().min(0, "Sale price must be non-negative"),
});

export const createPurchaseInvoiceSchema = z.object({
  distributorId: z.string().min(1, "Distributor is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  discount: z.number().min(0).optional().default(0),
  tax: z.number().min(0).optional().default(0),
  paidAmount: z.number().min(0).optional().default(0),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CREDIT"]).optional().default("CREDIT"),
  notes: z.string().optional().default(""),
  items: z.array(purchaseInvoiceItemSchema).min(1, "At least one item is required in the purchase invoice"),
});

export const recordSupplierPaymentSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than zero"),
  invoiceId: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE"]).optional().default("CASH"),
  referenceNumber: z.string().optional().default(""),
  paidAt: z.string().optional(),
  notes: z.string().optional().default(""),
});

export const listInvoicesQuerySchema = z.object({
  distributorId: z.string().optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "VOID", "ALL"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export type PurchaseInvoiceItemInput = z.infer<typeof purchaseInvoiceItemSchema>;
export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>;
export type RecordSupplierPaymentInput = z.infer<typeof recordSupplierPaymentSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
