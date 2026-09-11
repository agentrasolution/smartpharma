import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  contact: z.string().optional().default(""),
  address: z.string().optional().default(""),
  second_number: z.string().optional().default(""),
});

export const updateCompanySchema = createCompanySchema;

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
