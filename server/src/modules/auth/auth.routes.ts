import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  verifyPasswordSchema,
  recoverPasswordSchema,
  sendVerificationEmailSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordOtpSchema,
  refreshSchema,
  logoutSchema,
} from "./auth.schema";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", validate(logoutSchema), authController.logout);
router.post("/change-password", authenticate, validate(changePasswordSchema), authController.changePassword);
router.get("/me", authenticate, authController.me);
router.post("/verify-password", authenticate, validate(verifyPasswordSchema), authController.verifyPassword);
router.post("/generate-recovery-key", authenticate, authController.generateRecoveryKey);
router.post("/recover-password", validate(recoverPasswordSchema), authController.recoverPassword);

// Email verification routes
router.post("/send-verification-email", authenticate, validate(sendVerificationEmailSchema), authController.sendVerificationEmail);
router.post("/verify-email", authenticate, validate(verifyEmailSchema), authController.verifyEmail);

// Password recovery via OTP (Resend email)
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password-otp", validate(resetPasswordOtpSchema), authController.resetPasswordOtp);

export { router as authRoutes };