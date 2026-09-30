import type { Request, Response, NextFunction } from "express";
import { purchasesService } from "./purchases.service";
import { normalizeStockPurchase, normalizeStockPurchaseList } from "../../utils/normalize";
import { branchScope } from "../../middleware/auth";

export const purchasesController = {
  // Legacy Stock Purchases
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const stock = await purchasesService.list(scope);
      res.json(normalizeStockPurchaseList(stock));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await purchasesService.create(scope, req.body);
      res.json(normalizeStockPurchase(result));
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await purchasesService.update(scope, req.params.id, req.body);
      res.json(normalizeStockPurchase(result));
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await purchasesService.remove(scope, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },

  // Direct Supplier Invoices
  async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const userId = (req as any).user?.userId;
      const invoice = await purchasesService.createInvoice(scope, req.body, userId);
      res.status(201).json(invoice);
    } catch (err) { next(err); }
  },

  async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const invoices = await purchasesService.listInvoices(scope, req.query as any);
      res.json(invoices);
    } catch (err) { next(err); }
  },

  async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const invoice = await purchasesService.getInvoiceById(scope, req.params.id);
      res.json(invoice);
    } catch (err) { next(err); }
  },

  // Supplier Ledger & AP
  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const distributorId = req.params.distributorId || req.body.distributorId;
      const result = await purchasesService.recordPayment(scope, distributorId, req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  },

  async getDistributorLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const ledger = await purchasesService.getDistributorLedger(scope, req.params.id);
      res.json(ledger);
    } catch (err) { next(err); }
  },

  async getSuppliersLedgerSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const summary = await purchasesService.getSuppliersLedgerSummary(scope);
      res.json(summary);
    } catch (err) { next(err); }
  },
};
