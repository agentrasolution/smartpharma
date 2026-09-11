import { Router } from "express";
import { purchasesController } from "./purchases.controller";
import { validate } from "../../middleware/validate";
import { createStockSchema, updateStockSchema } from "./purchases.schema";

const router = Router();

router.get("/", purchasesController.list);
router.post("/", validate(createStockSchema), purchasesController.create);
router.put("/:id", validate(updateStockSchema), purchasesController.update);
router.delete("/:id", purchasesController.delete);

export { router as purchasesRoutes };
