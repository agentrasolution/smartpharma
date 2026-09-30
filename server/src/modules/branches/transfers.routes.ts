import { Router } from "express";
import { transfersController } from "./transfers.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createTransferSchema } from "./transfers.schema";

const router = Router();

router.use(authenticate);

// Cross-branch stock lookup
router.get("/cross-stock", authorize("products.view"), transfersController.getCrossBranchStock);
router.get("/cross-stock/:productId", authorize("products.view"), transfersController.getCrossBranchStock);

// Transfers list & details
router.get("/", authorize("transfers.view", "branches.view", "stock.view"), transfersController.listTransfers);
router.get("/:id", authorize("transfers.view", "branches.view", "stock.view"), transfersController.getTransferById);

// Transfer lifecycle operations
router.post(
  "/",
  validate(createTransferSchema),
  authorize("transfers.create", "branches.update", "stock.create"),
  transfersController.createTransfer,
);

router.post(
  "/:id/send",
  authorize("transfers.approve", "branches.update", "stock.update"),
  transfersController.sendTransfer,
);

router.post(
  "/:id/receive",
  authorize("transfers.receive", "branches.update", "stock.update"),
  transfersController.receiveTransfer,
);

router.post(
  "/:id/reject",
  authorize("transfers.approve", "branches.update", "stock.update"),
  transfersController.rejectTransfer,
);

router.post(
  "/:id/cancel",
  authorize("transfers.create", "branches.update"),
  transfersController.cancelTransfer,
);

export { router as transfersRoutes };
