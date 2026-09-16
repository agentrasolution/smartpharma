import type { Request, Response, NextFunction } from "express";
import { customersService } from "./customers.service";
import { branchScope } from "../../middleware/auth";

export const customersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const customers = await customersService.list(scope);
      res.json(customers);
    } catch (err) { next(err); }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const q = req.query.q as string;
      if (!q) return res.json([]);
      const customers = await customersService.search(scope, q);
      res.json(customers);
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const customer = await customersService.getById(scope, req.params.id);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const customer = await customersService.create(scope, req.body);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const customer = await customersService.update(scope, req.params.id, req.body);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const force = req.query.force === "true";
      const result = await customersService.delete(scope, req.params.id, force);
      res.json(result);
    } catch (err) { next(err); }
  },
};
