import type { Request, Response, NextFunction } from "express";
import { arrearsService } from "./arrears.service";

function normalizeArrear(a: Record<string, unknown>): Record<string, unknown> {
  return {
    id: a.id,
    sale_id: a.saleId ?? null,
    customer_id: a.customerId,
    customer_name: (a as any).customer?.name ?? null,
    total_bill: a.totalBill,
    amount_paid: a.amountPaid,
    balance_due: a.balanceDue,
    status: a.status,
    created_at: a.createdAt,
    payments: ((a as any).payments ?? []).map((p: Record<string, unknown>) => ({
      id: p.id,
      amount: p.amount,
      payment_sale_id: p.paymentSaleId ?? null,
      created_at: p.createdAt,
    })),
  };
}

export const arrearsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as string | undefined;
      const arrears = await arrearsService.list(status);
      res.json(arrears.map(normalizeArrear));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const arrear = await arrearsService.create(req.body);
      res.json(normalizeArrear(arrear));
    } catch (err) { next(err); }
  },

  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await arrearsService.recordPayment(req.params.id, req.body.amount, req.body.password);
      res.json({ ...result, arrear: normalizeArrear(result.arrear) });
    } catch (err) { next(err); }
  },

  async settle(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await arrearsService.settle(req.params.id, req.body.password);
      res.json({ ...result, arrear: normalizeArrear(result.arrear) });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await arrearsService.delete(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
