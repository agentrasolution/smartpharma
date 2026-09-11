import { Router } from "express";
import { aiController } from "./ai.controller";
import { validate } from "../../middleware/validate";
import { chatSchema } from "./ai.schema";
import { authenticate } from "../../middleware/auth";

const router = Router();

// All AI endpoints require authentication (spec #71).
router.use(authenticate);

router.post("/chat", validate(chatSchema), aiController.chat);
router.get("/conversations", aiController.conversations);
router.get("/conversations/:id", aiController.conversationById);
router.get("/audit-logs", aiController.auditLogs);

export { router as aiRoutes };