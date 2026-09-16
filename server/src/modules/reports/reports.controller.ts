import type { Request, Response, NextFunction } from "express";
import { reportsService } from "./reports.service";
import { branchScope } from "../../middleware/auth";

export const reportsController = {
  async stats(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req, { branchParam: true });
      const stats = await reportsService.getStats(scope);
      res.json(stats);
    } catch (err) { next(err); }
  },
};