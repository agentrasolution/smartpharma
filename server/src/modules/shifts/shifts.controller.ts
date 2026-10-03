import type { Request, Response, NextFunction } from "express";
import * as shiftsService from "./shifts.service";
import { branchScope } from "../../middleware/auth";
import {
  OpenShiftSchema,
  CashDropSchema,
  CloseShiftSchema,
  ListShiftsQuerySchema,
} from "./shifts.schema";

function getUserContext(req: Request) {
  const user = (req as any).user;
  return {
    id: user?.userId || "unknown",
    name: user?.name,
    username: user?.username || "Cashier",
  };
}

export const shiftsController = {
  async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = getUserContext(req);
      const shift = await shiftsService.getActiveShift(scope, user.id);
      res.json(shift);
    } catch (err) {
      next(err);
    }
  },

  async open(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = getUserContext(req);
      const parsed = OpenShiftSchema.parse(req.body);
      const shift = await shiftsService.openShift(scope, user, parsed);
      res.status(201).json(shift);
    } catch (err) {
      next(err);
    }
  },

  async drop(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = getUserContext(req);
      const parsed = CashDropSchema.parse(req.body);
      const drop = await shiftsService.recordCashDrop(scope, user, parsed);
      res.status(201).json(drop);
    } catch (err) {
      next(err);
    }
  },

  async getXReport(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const report = await shiftsService.getXReport(scope, req.params.id);
      res.json(report);
    } catch (err) {
      next(err);
    }
  },

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = getUserContext(req);
      const parsed = CloseShiftSchema.parse({ shiftId: req.params.id, ...req.body });
      const zReport = await shiftsService.closeShift(scope, user, parsed);
      res.json(zReport);
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const query = ListShiftsQuerySchema.parse(req.query);
      const result = await shiftsService.listShifts(scope, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await shiftsService.getShiftById(scope, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
