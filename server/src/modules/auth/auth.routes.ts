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

export { router as authRoutes };