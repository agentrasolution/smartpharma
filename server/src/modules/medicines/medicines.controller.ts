import type { Request, Response, NextFunction } from "express";
import { medicinesService } from "./medicines.service";
import { normalizeProduct, normalizeProductList } from "../../utils/normalize";

export const medicinesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 100;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const includeArchived = req.query.includeArchived === "true";
      const result = await medicinesService.list({ includeArchived, page, pageSize, search });
      res.json({
        data: normalizeProductList(result.data),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (err) { next(err); }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string;
      if (!q) return res.json([]);
      const products = await medicinesService.search(q);
      res.json(products);
    } catch (err) { next(err); }
  },

  async getByBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await medicinesService.getByBarcode(req.params.b);
      res.json(normalizeProduct(product));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await medicinesService.create(req.body);
      res.json(normalizeProduct(product));
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await medicinesService.update(req.params.id, req.body);
      res.json(normalizeProduct(product));
    } catch (err) { next(err); }
  },

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await medicinesService.archive(req.params.id);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await medicinesService.restore(req.params.id);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
};
