import { Router } from "express";
import { suppliersController } from "./suppliers.controller";
import { validate } from "../../middleware/validate";
import { createDistributorSchema, updateDistributorSchema } from "./suppliers.schema";

const router = Router();

router.get("/", suppliersController.list);
router.post("/", validate(createDistributorSchema), suppliersController.create);
router.put("/:id", validate(updateDistributorSchema), suppliersController.update);
router.delete("/:id", suppliersController.delete);

export { router as suppliersRoutes };
