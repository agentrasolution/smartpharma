import { Router } from "express";
import { reportsController } from "./reports.controller";
import { authenticate, authorize } from "../../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/stats", authorize("dashboard.view", "reports.view"), reportsController.stats);
router.get("/margins", authorize("reports.view"), reportsController.margins);
router.get("/losses", authorize("reports.view"), reportsController.losses);
router.get("/valuation", authorize("reports.view"), reportsController.valuation);
router.get("/profit-loss", authorize("reports.view"), reportsController.profitAndLoss);
router.get("/export", authorize("reports.export", "reports.view"), reportsController.exportReport);

export { router as reportsRoutes };
