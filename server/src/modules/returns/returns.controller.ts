import type { Request, Response, NextFunction } from "express";
import { returnsService } from "./returns.service";

function normalizeReturnItem(i: any) {
  return {
    id: i.id,
    product_id: i.productId,
    product_name: i.productName,
    quantity: i.quantity,
    refund_amount: i.refundAmount,
  };
}

function normalizeReturn(r: any) {
  return {
    id: r.id,
    sale_id: r.saleId,
    customer_name: r.sale?.customer?.name ?? null,
    refund_amount: r.refundAmount,
    reason: r.reason,
    created_at: r.createdAt,
    items: (r.items ?? []).map(normalizeReturnItem),
  };
}

export const returnsController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const returns = await returnsService.list();
      res.json(returns.map(normalizeReturn));
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await returnsService.getById(req.params.id);
      res.json(normalizeReturn(entry));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await returnsService.create(req.body);
      res.json(normalizeReturn(result));
    } catch (err) { next(err); }
  },
};
