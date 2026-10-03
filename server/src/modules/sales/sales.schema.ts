import { z } from "zod";

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  barcode: z.string().default(""),
  quantity: z.number().int().positive("Quantity must be greater than zero"),
  packagingUnit: z.string().optional().default("UNIT"),
  conversionRatio: z.number().int().positive().optional().default(1),
  quantityBaseUnits: z.number().int().positive().optional(),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  subtotal: z.number().min(0, "Subtotal cannot be negative"),
  batchId: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

export const createSaleSchema = z.object({
  customerId: z.string().optional().nullable(),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  total: z.number().min(0),
  amountPaid: z.number().min(0),
  paymentMethod: z.enum(["CASH", "CARD", "SPLIT", "CREDIT"]).default("CASH"),
  cashAmount: z.number().min(0).optional().default(0),
  cardAmount: z.number().min(0).optional().default(0),
  creditAmount: z.number().min(0).optional().default(0),
  prescriptionId: z.string().optional().nullable(),
  prescriptionNumber: z.string().optional().nullable(),
  cashierId: z.string().optional().nullable(),
  cashierName: z.string().optional().nullable(),
  notes: z.string().optional().default(""),
  items: z.array(saleItemSchema).min(1, "Cart must have at least one item"),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
