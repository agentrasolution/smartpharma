import type { Request, Response, NextFunction } from "express";
import { usersService } from "./users.service";
import { branchScope } from "../../middleware/auth";

export const usersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const users = await usersService.list(req.query as never, scope.pharmacyId);
      res.json(users);
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = await usersService.getById(req.params.id, scope.pharmacyId);
      res.json(user);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const actor = req.user!;
      const result = await usersService.create(req.body, scope.pharmacyId, actor);
      res.json(result);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const actor = req.user!;
      const user = await usersService.update(req.params.id, req.body, actor, scope.pharmacyId);
      res.json(user);
    } catch (err) { next(err); }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const actor = req.user!;
      const user = await usersService.updateStatus(req.params.id, req.body.isActive, actor, scope.pharmacyId);
      res.json(user);
    } catch (err) { next(err); }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const actor = req.user!;
      const result = await usersService.resetPassword(req.params.id, actor, scope.pharmacyId);
      res.json(result);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const actor = req.user!;
      const result = await usersService.delete(req.params.id, actor, scope.pharmacyId);
      res.json(result);
    } catch (err) { next(err); }
  },
};