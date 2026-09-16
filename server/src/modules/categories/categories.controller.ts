import type { Request, Response, NextFunction } from "express";
import { categoriesService } from "./categories.service";
import { branchScope } from "../../middleware/auth";

export const categoriesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const categories = await categoriesService.list({ pharmacyId: scope.pharmacyId });
      res.json(categories);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const category = await categoriesService.create({ pharmacyId: scope.pharmacyId }, req.body);
      res.json(category);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const category = await categoriesService.update({ pharmacyId: scope.pharmacyId }, req.params.id, req.body);
      res.json(category);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await categoriesService.remove({ pharmacyId: scope.pharmacyId }, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
