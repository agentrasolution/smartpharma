import { Router } from "express";
import { medicinesController } from "./medicines.controller";
import { validate } from "../../middleware/validate";
import { createProductSchema, copyCatalogSchema } from "./medicines.schema";
import { authorize } from "../../middleware/auth";

const router = Router();

router.get("/", medicinesController.list);
router.get("/search", medicinesController.search);
router.get("/barcode/:b", medicinesController.getByBarcode);
router.post("/", validate(createProductSchema), medicinesController.create);
router.put("/:id", validate(createProductSchema), medicinesController.update);
router.delete("/:id", medicinesController.archive);
router.post("/:id/restore", medicinesController.restore);
router.post(
  "/copy-catalog",
  validate(copyCatalogSchema),
  authorize("products.create", "products.update"),
  medicinesController.copyCatalog,
);

export { router as medicinesRoutes };