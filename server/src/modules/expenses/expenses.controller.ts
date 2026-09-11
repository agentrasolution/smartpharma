import type { Request, Response, NextFunction } from "express";
import { expensesService } from "./expenses.service";

export const expensesController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const expenses = await expensesService.list();
      res.json(expenses);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expensesService.create(req.body);
      res.json(expense);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const expense = await expensesService.update(req.params.id, req.body);
      res.json(expense);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await expensesService.delete(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
