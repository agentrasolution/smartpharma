import type { Request, Response, NextFunction } from "express";
import { purchaseOrderService } from "./purchase-order.service";
import { branchScope } from "../../middleware/auth";

export const purchaseOrderController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req, { branchParam: true });
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      res.json(await purchaseOrderService.list(scope, { status, search, from, to }));
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      res.json(await purchaseOrderService.getById(scope, req.params.id));
    } catch (err) { next(err); }
  },

  async createDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const order = await purchaseOrderService.createDraft(scope, req.body, {
        userId: req.user!.userId,
        role: req.user!.role,
      });
      res.status(201).json(order);
    } catch (err) { next(err); }
  },

  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const order = await purchaseOrderService.submitForApproval(scope, req.params.id, {
        userId: req.user!.userId,
        role: req.user!.role,
      });
      res.json(order);
    } catch (err) { next(err); }
  },

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const order = await purchaseOrderService.approve(scope, req.params.id, {
        userId: req.user!.userId,
        role: req.user!.role,
      });
      res.json(order);
    } catch (err) { next(err); }
  },

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const reason = req.body.reason as string;
      const order = await purchaseOrderService.reject(scope, req.params.id, {
        userId: req.user!.userId,
        role: req.user!.role,
      }, reason);
      res.json(order);
    } catch (err) { next(err); }
  },
};