import type { Request, Response, NextFunction } from "express";
import { medicinesService } from "./medicines.service";
import { normalizeProduct, normalizeProductList } from "../../utils/normalize";
import { branchScope } from "../../middleware/auth";

export const medicinesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req, { branchParam: true });
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 100;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const includeArchived = req.query.includeArchived === "true";
      const result = await medicinesService.list(scope, { includeArchived, page, pageSize, search });
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
      const scope = branchScope(req);
      const q = req.query.q as string;
      if (!q) return res.json([]);
      const products = await medicinesService.search(scope, q);
      res.json(products.map(normalizeProduct));
    } catch (err) { next(err); }
  },

  async getByBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const product = await medicinesService.getByBarcode(scope, req.params.b);
      res.json(normalizeProduct(product));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const product = await medicinesService.create(scope, req.body);
      res.status(201).json(normalizeProduct(product));
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const product = await medicinesService.update(scope, req.params.id, req.body);
      res.json(normalizeProduct(product));
    } catch (err) { next(err); }
  },

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      await medicinesService.archive(scope, req.params.id);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      await medicinesService.restore(scope, req.params.id);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async copyCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await medicinesService.copyCatalog(
        scope,
        req.body.fromBranchId,
        req.body.toBranchId,
      );
      res.json(result);
    } catch (err) { next(err); }
  },
};