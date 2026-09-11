import type { Request, Response, NextFunction } from "express";
import { categoriesService } from "./categories.service";

export const categoriesController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await categoriesService.list();
      res.json(categories);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.create(req.body);
      res.json(category);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.update(req.params.id, req.body);
      res.json(category);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await categoriesService.remove(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
