import { Router } from "express";
import { branchesController } from "./branches.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createBranchSchema, updateBranchSchema } from "./branches.schema";

const router = Router();

router.use(authenticate);

router.get("/", authorize("branches.view"), branchesController.list);
router.get("/:id", authorize("branches.view"), branchesController.getById);
router.post("/", validate(createBranchSchema), authorize("branches.create"), branchesController.create);
router.patch("/:id", validate(updateBranchSchema), authorize("branches.update"), branchesController.update);
router.delete("/:id", authorize("branches.delete"), branchesController.delete);

export { router as branchesRoutes };