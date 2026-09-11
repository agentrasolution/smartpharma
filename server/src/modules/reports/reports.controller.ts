import type { Request, Response, NextFunction } from "express";
import { reportsService } from "./reports.service";

export const reportsController = {
  async stats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await reportsService.getStats();
      res.json(stats);
    } catch (err) { next(err); }
  },
};
