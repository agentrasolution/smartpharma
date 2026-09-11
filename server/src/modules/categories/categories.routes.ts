import { Router } from "express";
import { categoriesController } from "./categories.controller";
import { validate } from "../../middleware/validate";
import { createCategorySchema, updateCategorySchema } from "./categories.schema";

const router = Router();

router.get("/", categoriesController.list);
router.post("/", validate(createCategorySchema), categoriesController.create);
router.put("/:id", validate(updateCategorySchema), categoriesController.update);
router.delete("/:id", categoriesController.delete);

export { router as categoriesRoutes };
