import type { Request, Response, NextFunction } from "express";
import { batchService } from "./batch.service";
import { stockMovementService } from "./stock-movement.service";
import { branchScope } from "../../middleware/auth";

export const inventoryController = {
  // ---- Batch endpoints ----

  listBatchesForProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const batches = await batchService.listForProduct(scope, req.params.productId);
      res.json(batches);
    } catch (err) {
      next(err);
    }
  },

  listAllBatches: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const { status, isRecalled } = req.query as Record<string, string>;
      const batches = await batchService.listAll(scope, {
        status,
        isRecalled: isRecalled !== undefined ? isRecalled === "true" : undefined,
      });
      res.json(batches);
    } catch (err) {
      next(err);
    }
  },

  getBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const batch = await batchService.getById(scope, req.params.id);
      res.json(batch);
    } catch (err) {
      next(err);
    }
  },

  receiveBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const batch = await batchService.receive(scope, req.body, (req as any).user?.id);
      res.status(201).json(batch);
    } catch (err) {
      next(err);
    }
  },

  adjustBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const result = await batchService.adjust(scope, {
        batchId: req.params.id,
        ...req.body,
        createdById: (req as any).user?.id,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  recallBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const result = await batchService.recall(scope, req.params.id, req.body.reason);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  getExpiringSoon: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const days = Number(req.query.days ?? 90);
      const batches = await batchService.getExpiringSoon(scope, days);
      res.json(batches);
    } catch (err) {
      next(err);
    }
  },

  // ---- Stock movement endpoints ----

  listMovements: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const result = await stockMovementService.list(scope, req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  valuationSnapshot: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const result = await stockMovementService.valuationSnapshot(scope);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  movementSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = branchScope(req);
      const { from, to } = req.query as { from: string; to: string };
      if (!from || !to) {
        res.status(400).json({ error: "'from' and 'to' query params are required" });
        return;
      }
      const result = await stockMovementService.summary(scope, from, to);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
