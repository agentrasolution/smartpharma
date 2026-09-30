import type { Request, Response, NextFunction } from "express";
import { salesService } from "./sales.service";
import { branchScope } from "../../middleware/auth";

function normalizeSale(s: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!s) return null;
  const items = ((s as any).items ?? []) as any[];

  const returnedByProduct: Record<string, number> = {};
  const returns = (s as any).returns ?? [];
  for (const r of returns) {
    for (const ri of r.items ?? []) {
      returnedByProduct[ri.productId] = (returnedByProduct[ri.productId] ?? 0) + ri.quantity;
    }
  }

  return {
    id: s.id,
    customer_id: s.customerId ?? null,
    customer_name: (s as any).customer?.name ?? null,
    subtotal: s.subtotal,
    discount: s.discount,
    total: s.total,
    amount_paid: s.amountPaid,
    change: s.change,
    status: s.status,
    payment_method: (s as any).paymentMethod ?? "CASH",
    cash_amount: (s as any).cashAmount ?? 0,
    card_amount: (s as any).cardAmount ?? 0,
    credit_amount: (s as any).creditAmount ?? 0,
    prescription_id: (s as any).prescriptionId ?? null,
    prescription_number: (s as any).prescriptionNumber ?? null,
    cashier_id: (s as any).cashierId ?? null,
    cashier_name: (s as any).cashierName ?? null,
    notes: (s as any).notes ?? "",
    created_at: s.createdAt,
    items: items.map((i: any) => ({
      id: i.id,
      sale_id: i.saleId ?? s.id,
      product_id: i.productId,
      product_name: i.productName,
      barcode: i.barcode,
      quantity: i.quantity,
      returned_qty: returnedByProduct[i.productId] ?? 0,
      unit_price: i.unitPrice,
      subtotal: i.subtotal,
      batch_id: i.batchId ?? null,
      batch_number: i.batchNumber ?? null,
      expiry_date: i.expiryDate ?? null,
    })),
    item_count: (s as any)._count?.items ?? items.length,
    return_count: (s as any)._count?.returns ?? 0,
  };
}

export const salesController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const user = (req as any).user;
      const payload = {
        ...req.body,
        cashierId: req.body.cashierId || user?.userId || null,
        cashierName: req.body.cashierName || user?.name || user?.username || null,
      };
      const sale = await salesService.create(payload, scope);
      res.json(normalizeSale(sale));
    } catch (err) { next(err); }
  },

  async listRecent(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const limit = parseInt(req.query.limit as string) || 10;
      const sales = await salesService.listRecent(scope, limit);
      res.json(sales.map(normalizeSale));
    } catch (err) { next(err); }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const q = (req.query.q as string) ?? "";
      if (!q.trim()) return res.json([]);
      const sales = await salesService.search(scope, q);
      res.json(sales.map(normalizeSale));
    } catch (err) { next(err); }
  },

  async listByDate(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const tzOffsetMinutes = parseInt(req.query.tzOffset as string, 10) || 0;
      const sales = await salesService.listByDate(scope, req.params.date, tzOffsetMinutes);
      res.json(sales.map(normalizeSale));
    } catch (err) { next(err); }
  },

  async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const sales = await salesService.listAll(scope, {
        search: req.query.search as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        tzOffsetMinutes: parseInt(req.query.tzOffset as string, 10) || 0,
      });
      res.json(sales.map(normalizeSale));
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const sale = await salesService.getById(scope, req.params.id);
      res.json(normalizeSale(sale));
    } catch (err) { next(err); }
  },
};
