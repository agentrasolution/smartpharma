import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  pharmacyName: z.string().min(1, "Pharmacy name is required"),
  contact: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  address: z.string().optional().default(""),
  countryCode: z.string().optional().default(""),
  countryName: z.string().optional().default(""),
  city: z.string().optional().default(""),
  currency: z.string().optional().default("SAR"),
  name: z.string().min(1, "Full name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1),
});

export const recoverPasswordSchema = z.object({
  username: z.string().min(1),
  phrase: z.string().min(1),
  newPassword: z.string().min(8),
});

export const sendVerificationEmailSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
});

export const verifyEmailSchema = z.object({
  code: z.string().min(4).max(10),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
});

export const resetPasswordOtpSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  code: z.string().min(4, "OTP code is required").max(10),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  accessToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;
export type RecoverPasswordInput = z.infer<typeof recoverPasswordSchema>;
export type SendVerificationEmailInput = z.infer<typeof sendVerificationEmailSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordOtpInput = z.infer<typeof resetPasswordOtpSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
