import { Router } from "express";
import { reportsController } from "./reports.controller";

const router = Router();

router.get("/stats", reportsController.stats);

export { router as reportsRoutes };
