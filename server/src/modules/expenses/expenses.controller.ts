import type { Request, Response, NextFunction } from "express";
import { expensesService } from "./expenses.service";
import { branchScope } from "../../middleware/auth";

export const expensesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const expenses = await expensesService.list(scope);
      res.json(expenses);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const expense = await expensesService.create(scope, req.body);
      res.json(expense);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const expense = await expensesService.update(scope, req.params.id, req.body);
      res.json(expense);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await expensesService.delete(scope, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
