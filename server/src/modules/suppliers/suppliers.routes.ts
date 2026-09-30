import { Router } from "express";
import { suppliersController } from "./suppliers.controller";
import { purchasesController } from "../purchases/purchases.controller";
import { validate } from "../../middleware/validate";
import { createDistributorSchema, updateDistributorSchema } from "./suppliers.schema";
import { recordSupplierPaymentSchema } from "../purchases/purchases.schema";

const router = Router();

// Ledger summary must come before :id to prevent capturing 'ledger' as an ID
router.get("/ledger/summary", purchasesController.getSuppliersLedgerSummary);
router.get("/:id/ledger", purchasesController.getDistributorLedger);
router.post("/:distributorId/payments", validate(recordSupplierPaymentSchema), purchasesController.recordPayment);

router.get("/", suppliersController.list);
router.post("/", validate(createDistributorSchema), suppliersController.create);
router.put("/:id", validate(updateDistributorSchema), suppliersController.update);
router.delete("/:id", suppliersController.delete);

export { router as suppliersRoutes };
