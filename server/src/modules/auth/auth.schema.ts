import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1),
});

export const recoverPasswordSchema = z.object({
  phrase: z.string().min(1),
  newPassword: z.string().min(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  accessToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;
export type RecoverPasswordInput = z.infer<typeof recoverPasswordSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
