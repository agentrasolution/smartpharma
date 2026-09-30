import type { Request, Response, NextFunction } from "express";
import { drugMasterService } from "./drug-master.service";
import { branchScope } from "../../middleware/auth";
import { runExpiryAlertPass } from "../../workers/expiry-alert.worker";

export const drugMasterController = {
  search: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const { q, isRx, isControlled, dosageForm, category, page, limit } = req.query as Record<string, string>;
      const result = await drugMasterService.search(scope, {
        q,
        isRx: isRx !== undefined ? isRx === "true" : undefined,
        isControlled: isControlled !== undefined ? isControlled === "true" : undefined,
        dosageForm,
        category,
        page: page ? Number(page) : 1,
        limit: limit ? Math.min(Number(limit), 200) : 50,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const result = await drugMasterService.getById(scope, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const result = await drugMasterService.update(scope, req.params.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  bulkImport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      // req.body is the validated array from the validate() middleware
      const result = await drugMasterService.bulkImport(scope, req.body);
      res.status(result.summary.errors > 0 ? 207 : 200).json(result);
    } catch (err) {
      next(err);
    }
  },

  listDosageForms: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const forms = await drugMasterService.listDosageForms(scope);
      res.json(forms);
    } catch (err) {
      next(err);
    }
  },

  listIncomplete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const { page, limit } = req.query as Record<string, string>;
      const result = await drugMasterService.listIncomplete(
        scope,
        page ? Number(page) : 1,
        limit ? Number(limit) : 100
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // On-demand expiry scan (callable from admin panel without waiting for nightly run)
  runExpiryScan: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = req.query.days ? Number(req.query.days) : undefined;
      const summary = await runExpiryAlertPass(days);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
};
