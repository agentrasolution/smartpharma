import { Router } from "express";
import { settingsController } from "./settings.controller";
import { authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { aiConfigSchema } from "./settings.schema";

const router = Router();

// Backup routes
router.post("/backup", authorize("settings.update"), settingsController.createBackup);
router.get("/backups", authorize("settings.view"), settingsController.listBackups);
router.delete("/backup", authorize("settings.update"), settingsController.deleteBackup);
router.post("/backup/restore", authorize("settings.update"), settingsController.restoreBackup);
router.get("/backup/directory", authorize("settings.view"), settingsController.getBackupDirectory);

// Google Drive routes
router.get("/gdrive", authorize("settings.view"), settingsController.getGdriveConfig);
router.put("/gdrive", authorize("settings.update"), settingsController.saveGdriveConfig);

// AI provider routes
router.get("/ai", authorize("settings.view"), settingsController.getAIConfig);
router.put("/ai", validate(aiConfigSchema), authorize("settings.update"), settingsController.saveAIConfig);
router.post("/ai/test", validate(aiConfigSchema), authorize("settings.update"), settingsController.testAIConnection);

export { router as settingsRoutes };