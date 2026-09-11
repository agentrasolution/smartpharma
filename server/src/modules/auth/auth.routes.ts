import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { verifyPasswordSchema, recoverPasswordSchema, refreshSchema, logoutSchema } from "./auth.schema";

const router = Router();

router.post("/login", authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", validate(logoutSchema), authController.logout);
router.get("/me", authenticate, authController.me);
router.post("/verify-password", validate(verifyPasswordSchema), authController.verifyPassword);
router.post("/generate-recovery-key", authController.generateRecoveryKey);
router.post("/recover-password", validate(recoverPasswordSchema), authController.recoverPassword);

export { router as authRoutes };
