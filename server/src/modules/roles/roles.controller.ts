import type { Request, Response, NextFunction } from "express";
import { rolesService } from "./roles.service";
import { branchScope } from "../../middleware/auth";

export const rolesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const roles = await rolesService.list(scope.pharmacyId);
      res.json(roles);
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const role = await rolesService.getById(req.params.id, scope.pharmacyId);
      res.json(role);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const role = await rolesService.create(req.body, scope.pharmacyId);
      res.json(role);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const role = await rolesService.update(req.params.id, req.body, scope.pharmacyId);
      res.json(role);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await rolesService.delete(req.params.id, scope.pharmacyId);
      res.json(result);
    } catch (err) { next(err); }
  },
};

export const permissionsController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(rolesService.allPermissions());
    } catch (err) { next(err); }
  },
};