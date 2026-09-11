import type { Request, Response, NextFunction } from "express";
import { customersService } from "./customers.service";

export const customersController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const customers = await customersService.list();
      res.json(customers);
    } catch (err) { next(err); }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string;
      if (!q) return res.json([]);
      const customers = await customersService.search(q);
      res.json(customers);
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await customersService.getById(req.params.id);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await customersService.create(req.body);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await customersService.update(req.params.id, req.body);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const force = req.query.force === "true";
      const result = await customersService.delete(req.params.id, force);
      res.json(result);
    } catch (err) { next(err); }
  },
};
