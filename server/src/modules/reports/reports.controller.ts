import type { Response, NextFunction } from "express";
import { reportsService } from "./reports.service";
import type { AuthenticatedRequest } from "../../middleware/auth";

export const reportsController = {
  async stats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const stats = await reportsService.getStats(scope);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },

  async margins(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const query = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        branchId: req.query.branchId as string | undefined,
        groupBy: (req.query.groupBy as any) || "drug",
      };
      const report = await reportsService.getMarginReport(scope, query);
      res.json(report);
    } catch (err) {
      next(err);
    }
  },

  async losses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const query = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };
      const report = await reportsService.getLossReport(scope, query);
      res.json(report);
    } catch (err) {
      next(err);
    }
  },

  async valuation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const report = await reportsService.getStockValuation(scope);
      res.json(report);
    } catch (err) {
      next(err);
    }
  },

  async profitAndLoss(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const query = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };
      const report = await reportsService.getProfitAndLoss(scope, query);
      res.json(report);
    } catch (err) {
      next(err);
    }
  },

  async exportReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const query = {
        type: (req.query.type as any) || "sales_cogs",
        format: (req.query.format as any) || "csv",
        groupBy: (req.query.groupBy as any) || "drug",
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };
      const exported = await reportsService.exportReport(scope, query);

      if (exported.contentType === "text/csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
        res.send(exported.data);
      } else {
        res.json(exported.data);
      }
    } catch (err) {
      next(err);
    }
  },
};