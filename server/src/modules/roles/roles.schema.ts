import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").max(100),
  description: z.string().optional().default(""),
  permissionNames: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  permissionNames: z.array(z.string()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;