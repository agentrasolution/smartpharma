import { z } from "zod";

export const createDistributorSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  contact: z.string().optional().default(""),
  address: z.string().optional().default(""),
  companyId: z.string().optional(),
});

export const updateDistributorSchema = createDistributorSchema;

export type CreateDistributorInput = z.infer<typeof createDistributorSchema>;
