import { z } from "zod";

export const createExpenseSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().positive(),
  notes: z.string().optional().default(""),
  date: z.string(),
});

export const updateExpenseSchema = createExpenseSchema;

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
