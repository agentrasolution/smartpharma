import { Router } from "express";
import { companiesController } from "./companies.controller";
import { validate } from "../../middleware/validate";
import { createCompanySchema, updateCompanySchema } from "./companies.schema";

const router = Router();

router.get("/", companiesController.list);
router.post("/", validate(createCompanySchema), companiesController.create);
router.put("/:id", validate(updateCompanySchema), companiesController.update);
router.delete("/:id", companiesController.delete);

export { router as companiesRoutes };
