import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").max(200),
  address: z.string().max(500).optional().default(""),
  phone: z.string().max(50).optional().default(""),
  isActive: z.boolean().optional().default(true),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;