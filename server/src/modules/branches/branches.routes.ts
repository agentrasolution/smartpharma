import { Router } from "express";
import { branchesController } from "./branches.controller";
import { transfersController } from "./transfers.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createBranchSchema, updateBranchSchema } from "./branches.schema";
import { branchPriceOverrideSchema } from "./transfers.schema";

const router = Router();

router.use(authenticate);

// Cross-branch stock lookup
router.get("/cross-stock", authorize("products.view"), transfersController.getCrossBranchStock);
router.get("/cross-stock/:productId", authorize("products.view"), transfersController.getCrossBranchStock);

// Standard branch CRUD
router.get("/", authorize("branches.view"), branchesController.list);
router.get("/:id", authorize("branches.view"), branchesController.getById);
router.post("/", validate(createBranchSchema), authorize("branches.create"), branchesController.create);
router.patch("/:id", validate(updateBranchSchema), authorize("branches.update"), branchesController.update);
router.delete("/:id", authorize("branches.delete"), branchesController.delete);

// Branch Price Overrides
router.get("/:branchId/price-overrides", authorize("branches.view", "products.view"), transfersController.getBranchPriceOverrides);
router.post(
  "/:branchId/price-overrides",
  validate(branchPriceOverrideSchema),
  authorize("branches.update", "products.update"),
  transfersController.setBranchPriceOverride,
);
router.delete(
  "/:branchId/price-overrides/:productId",
  authorize("branches.update", "products.update"),
  transfersController.deleteBranchPriceOverride,
);

export { router as branchesRoutes };