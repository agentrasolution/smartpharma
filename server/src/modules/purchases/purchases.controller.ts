import type { Request, Response, NextFunction } from "express";
import { purchasesService } from "./purchases.service";
import { normalizeStockPurchase, normalizeStockPurchaseList } from "../../utils/normalize";

export const purchasesController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const stock = await purchasesService.list();
      res.json(normalizeStockPurchaseList(stock));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await purchasesService.create(req.body);
      res.json(normalizeStockPurchase(result));
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await purchasesService.update(req.params.id, req.body);
      res.json(normalizeStockPurchase(result));
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await purchasesService.remove(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
