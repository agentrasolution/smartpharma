import type { Request, Response, NextFunction } from "express";
import { suppliersService } from "./suppliers.service";

export const suppliersController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const distributors = await suppliersService.list();
      res.json(distributors);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const distributor = await suppliersService.create(req.body);
      res.json(distributor);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const distributor = await suppliersService.update(req.params.id, req.body);
      res.json(distributor);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await suppliersService.remove(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
