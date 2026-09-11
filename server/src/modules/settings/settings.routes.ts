import { Router } from "express";
import { settingsController } from "./settings.controller";
import { validate } from "../../middleware/validate";
import { aiConfigSchema } from "./settings.schema";

const router = Router();

// Backup routes
router.post("/backup", settingsController.createBackup);
router.get("/backups", settingsController.listBackups);
router.delete("/backup", settingsController.deleteBackup);
router.post("/backup/restore", settingsController.restoreBackup);
router.get("/backup/directory", settingsController.getBackupDirectory);

// Google Drive routes
router.get("/gdrive", settingsController.getGdriveConfig);
router.put("/gdrive", settingsController.saveGdriveConfig);

// AI provider routes
router.get("/ai", settingsController.getAIConfig);
router.put("/ai", validate(aiConfigSchema), settingsController.saveAIConfig);
router.post("/ai/test", validate(aiConfigSchema), settingsController.testAIConnection);

export { router as settingsRoutes };
