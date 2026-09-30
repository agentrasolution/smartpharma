import { Router } from "express";
import { medicinesController } from "./medicines.controller";
import { drugMasterController } from "./drug-master.controller";
import { validate } from "../../middleware/validate";
import { createProductSchema, copyCatalogSchema } from "./medicines.schema";
import { updateDrugMasterSchema, bulkImportSchema } from "./drug-master.schema";
import { authorize } from "../../middleware/auth";

const router = Router();

// ---- Existing product CRUD ----
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

// ---- Drug Master Data (Pillar B) ----
// Search & filter drug master records
router.get("/drug-master", drugMasterController.search);
// Data quality: products missing drug master fields
router.get("/drug-master/incomplete", drugMasterController.listIncomplete);
// Available dosage form values for filter dropdowns
router.get("/drug-master/dosage-forms", drugMasterController.listDosageForms);
// On-demand expiry scan (admin trigger without waiting for nightly worker)
router.post("/drug-master/run-expiry-scan", drugMasterController.runExpiryScan);
// Bulk import/update drug master data from JSON array
router.post(
  "/drug-master/bulk-import",
  validate(bulkImportSchema),
  authorize("products.update"),
  drugMasterController.bulkImport,
);
// Get & update drug master for a single product
router.get("/drug-master/:id", drugMasterController.getById);
router.patch(
  "/drug-master/:id",
  validate(updateDrugMasterSchema),
  drugMasterController.update,
);

export { router as medicinesRoutes };