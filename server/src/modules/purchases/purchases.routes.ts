import { Router } from "express";
import { purchasesController } from "./purchases.controller";
import { validate } from "../../middleware/validate";
import {
  createStockSchema,
  updateStockSchema,
  createPurchaseInvoiceSchema,
  recordSupplierPaymentSchema,
} from "./purchases.schema";

const router = Router();

// --- Direct Supplier Invoices ---
router.get("/invoices", purchasesController.listInvoices);
router.post("/invoices", validate(createPurchaseInvoiceSchema), purchasesController.createInvoice);
router.get("/invoices/:id", purchasesController.getInvoiceById);
router.post("/invoices/:distributorId/payments", validate(recordSupplierPaymentSchema), purchasesController.recordPayment);

// --- Supplier Ledger & AP Summary ---
router.get("/suppliers/ledger/summary", purchasesController.getSuppliersLedgerSummary);
router.get("/distributors/:id/ledger", purchasesController.getDistributorLedger);
router.post("/distributors/:distributorId/payments", validate(recordSupplierPaymentSchema), purchasesController.recordPayment);

// --- Direct Invoices routes when router is mounted at /api/purchase-invoices ---
router.get("/", (req, res, next) => {
  // If query indicates listing purchase invoices or if path is root for purchase-invoices
  if (req.baseUrl.includes("purchase-invoices")) {
    return purchasesController.listInvoices(req, res, next);
  }
  return purchasesController.list(req, res, next);
});

router.post("/", (req, res, next) => {
  if (req.baseUrl.includes("purchase-invoices") || req.body?.items) {
    return validate(createPurchaseInvoiceSchema)(req, res, () => purchasesController.createInvoice(req, res, next));
  }
  return validate(createStockSchema)(req, res, () => purchasesController.create(req, res, next));
});

router.get("/:id", (req, res, next) => {
  if (req.baseUrl.includes("purchase-invoices")) {
    return purchasesController.getInvoiceById(req, res, next);
  }
  return next();
});

router.put("/:id", validate(updateStockSchema), purchasesController.update);
router.delete("/:id", purchasesController.delete);

export { router as purchasesRoutes };
