import { Router } from "express";
import { purchaseOrderController } from "./purchase-order.controller";
import { validate } from "../../middleware/validate";
import {
  createPurchaseOrderDraftSchema,
  rejectPurchaseOrderSchema,
} from "./purchase-order.schema";
import { authenticate } from "../../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", purchaseOrderController.list);
router.get("/:id", purchaseOrderController.getById);
router.post("/", validate(createPurchaseOrderDraftSchema), purchaseOrderController.createDraft);
router.post("/:id/submit", purchaseOrderController.submit);
router.post("/:id/approve", purchaseOrderController.approve);
router.post("/:id/reject", validate(rejectPurchaseOrderSchema), purchaseOrderController.reject);

export { router as purchaseOrderRoutes };