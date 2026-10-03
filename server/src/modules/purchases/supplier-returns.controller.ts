import type { Request, Response, NextFunction } from "express";
import { supplierReturnsService } from "./supplier-returns.service";
import { branchScope } from "../../middleware/auth";
import {
  CreateSupplierReturnSchema,
  ApproveSupplierReturnSchema,
  RejectSupplierReturnSchema,
  ListSupplierReturnsQuerySchema,
} from "./supplier-returns.schema";

function getUserContext(req: Request) {
  const user = (req as any).user;
  return {
    id: user?.userId || user?.id || "unknown",
    name: user?.name,
    username: user?.username || "Pharmacist",
  };
}

export const supplierReturnsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const query = ListSupplierReturnsQuerySchema.parse(req.query);
      const result = await supplierReturnsService.list(scope, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const distributorId = req.query.distributorId as string | undefined;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
      const candidates = await supplierReturnsService.getCandidates(scope, distributorId, days);
      res.json(candidates);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await supplierReturnsService.getById(scope, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = getUserContext(req);
      const parsed = CreateSupplierReturnSchema.parse(req.body);
      const result = await supplierReturnsService.create(scope, user, parsed);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = getUserContext(req);
      const parsed = ApproveSupplierReturnSchema.parse(req.body);
      const result = await supplierReturnsService.approve(scope, user, req.params.id, parsed);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = getUserContext(req);
      const parsed = RejectSupplierReturnSchema.parse(req.body);
      const result = await supplierReturnsService.reject(scope, user, req.params.id, parsed.reason);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
