import type { Request, Response, NextFunction } from "express";
import { branchesService } from "./branches.service";
import { branchScope } from "../../middleware/auth";

export const branchesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const branches = await branchesService.list(scope.pharmacyId);
      res.json(branches);
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const branch = await branchesService.getById(req.params.id, scope.pharmacyId);
      res.json(branch);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const branch = await branchesService.create(req.body, scope.pharmacyId);
      res.json(branch);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const branch = await branchesService.update(req.params.id, req.body, scope.pharmacyId);
      res.json(branch);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await branchesService.delete(req.params.id, scope.pharmacyId);
      res.json(result);
    } catch (err) { next(err); }
  },
};