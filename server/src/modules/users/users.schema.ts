import { z } from "zod";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(50)
  .regex(/^[a-zA-Z0-9_.]+$/, "Username can only contain letters, numbers, dots and underscores");

const emailSchema = z.union([z.string().email("Invalid email"), z.literal("")]);

export const JOB_ROLES = ["admin", "manager", "stock_manager", "salesman", "cashier", "helper"] as const;
export const jobRoleSchema = z.union([z.enum(JOB_ROLES), z.literal("")]);

export const createUserSchema = z.object({
  username: usernameSchema,
  name: z.string().min(1, "Full name is required").max(200),
  phone: z.string().optional().default(""),
  email: emailSchema.optional().default(""),
  roleId: z.string().min(1, "Role is required"),
  branchId: z.string().nullable().optional(),
  jobRole: jobRoleSchema.optional().default(""),
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional(),
  email: emailSchema.optional(),
  roleId: z.string().min(1).optional(),
  branchId: z.string().nullable().optional(),
  jobRole: jobRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const userStatusSchema = z.object({
  isActive: z.boolean(),
});

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  branch: z.string().optional(),
  status: z.enum(["active", "inactive", "all"]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserStatusInput = z.infer<typeof userStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;