import { Router } from "express";
import { inventoryController } from "./inventory.controller";
import { validate } from "../../middleware/validate";
import {
  createBatchSchema,
  adjustBatchSchema,
  recallBatchSchema,
  movementFilterSchema,
} from "./inventory.schema";

const router = Router();

// ---- Batch routes ----
router.get("/batches", inventoryController.listAllBatches);
router.get("/batches/expiring-soon", inventoryController.getExpiringSoon);
router.get("/batches/product/:productId", inventoryController.listBatchesForProduct);
router.get("/batches/:id", inventoryController.getBatch);
router.post("/batches", validate(createBatchSchema), inventoryController.receiveBatch);
router.patch("/batches/:id/adjust", validate(adjustBatchSchema), inventoryController.adjustBatch);
router.patch("/batches/:id/recall", validate(recallBatchSchema), inventoryController.recallBatch);

// ---- Stock movement routes ----
router.get("/movements", inventoryController.listMovements);
router.get("/movements/summary", inventoryController.movementSummary);
router.get("/valuation", inventoryController.valuationSnapshot);

export { router as inventoryRoutes };
