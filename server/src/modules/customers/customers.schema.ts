import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  fatherName: z.string().optional().default(""),
  fatherPhone: z.string().optional().default(""),
});

export const updateCustomerSchema = createCustomerSchema;

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
