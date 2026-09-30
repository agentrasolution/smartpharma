import { Router } from "express";
import { customersController } from "./customers.controller";
import { validate } from "../../middleware/validate";
import {
  createCustomerSchema,
  updateCustomerSchema,
  createChronicMedicationSchema,
  updateChronicMedicationSchema,
  recordContactSchema,
  recordRefillSchema,
} from "./customers.schema";

const router = Router();

// Specific routes first to prevent collision with /:id
router.get("/refills/queue", customersController.getRefillQueue);
router.post("/chronic-medications", validate(createChronicMedicationSchema), customersController.addChronicMedication);
router.put("/chronic-medications/:medId", validate(updateChronicMedicationSchema), customersController.updateChronicMedication);
router.delete("/chronic-medications/:medId", customersController.deleteChronicMedication);
router.post("/chronic-medications/:medId/contact", validate(recordContactSchema), customersController.recordContact);
router.post("/chronic-medications/:medId/refill", validate(recordRefillSchema), customersController.recordRefill);

// General customer routes
router.get("/", customersController.list);
router.get("/search", customersController.search);
router.get("/:id", customersController.getById);
router.get("/:id/statement", customersController.getStatement);
router.get("/:id/chronic-medications", customersController.listChronicMedications);
router.post("/", validate(createCustomerSchema), customersController.create);
router.put("/:id", validate(updateCustomerSchema), customersController.update);
router.delete("/:id", customersController.delete);

export { router as customersRoutes };
