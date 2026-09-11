import { Router } from "express";
import { customersController } from "./customers.controller";
import { validate } from "../../middleware/validate";
import { createCustomerSchema, updateCustomerSchema } from "./customers.schema";

const router = Router();

router.get("/", customersController.list);
router.get("/search", customersController.search);
router.get("/:id", customersController.getById);
router.post("/", validate(createCustomerSchema), customersController.create);
router.put("/:id", validate(updateCustomerSchema), customersController.update);
router.delete("/:id", customersController.delete);

export { router as customersRoutes };
