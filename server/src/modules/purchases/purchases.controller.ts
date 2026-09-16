import type { Request, Response, NextFunction } from "express";
import { purchasesService } from "./purchases.service";
import { normalizeStockPurchase, normalizeStockPurchaseList } from "../../utils/normalize";
import { branchScope } from "../../middleware/auth";

export const purchasesController = {
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
};
