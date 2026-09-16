import type { Request, Response, NextFunction } from "express";
import { suppliersService } from "./suppliers.service";
import { branchScope } from "../../middleware/auth";

export const suppliersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const distributors = await suppliersService.list({ pharmacyId: scope.pharmacyId });
      res.json(distributors);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const distributor = await suppliersService.create({ pharmacyId: scope.pharmacyId }, req.body);
      res.json(distributor);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const distributor = await suppliersService.update({ pharmacyId: scope.pharmacyId }, req.params.id, req.body);
      res.json(distributor);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await suppliersService.remove({ pharmacyId: scope.pharmacyId }, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
