import { z } from "zod";

export const createArrearSchema = z.object({
  customerId: z.string(),
  totalBill: z.number(),
  amountPaid: z.number().nonnegative().optional().default(0),
  saleId: z.string().optional(),
});

export const payArrearSchema = z.object({
  amount: z.number().positive(),
  password: z.string().min(1),
});

export const settleArrearSchema = z.object({
  password: z.string().min(1),
});

export type CreateArrearInput = z.infer<typeof createArrearSchema>;
