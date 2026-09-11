import type { Request, Response, NextFunction } from "express";
import { inventoryIntelligence } from "../../inventory/inventory.service";
import { recommendationService } from "../../inventory/recommendations.service";

export const aiInventoryController = {
  async summary(_req: Request, res: Response, next: NextFunction) {
    try {
      const days = Number(_req.query.days ?? 30);
      res.json(await inventoryIntelligence.getSummary(days));
    } catch (err) { next(err); }
  },

  async products(req: Request, res: Response, next: NextFunction) {
    try {
      const riskLevel = String(req.query.riskLevel ?? "CRITICAL");
      const limit = Number(req.query.limit ?? 20);
      const days = Number(req.query.days ?? 30);
      const rows = await inventoryIntelligence.getProductsByRisk(riskLevel as never, limit, days);
      res.json(rows.map((r) => ({
        productId: r.product.id,
        name: r.product.name,
        barcode: r.product.barcode,
        category: r.product.category,
        currentStock: r.currentStock,
        averageDailySales: r.averageDailySales,
        stockCoverageDays: r.stockCoverageDays,
        estimatedStockoutDays: r.estimatedStockoutDays,
        leadTimeDays: r.leadTimeDays,
        reorderPoint: r.reorderPoint,
        recommendedQuantity: r.recommendedQuantity,
        recommendedQuantityPacked: r.recommendedQuantityPacked,
        riskLevel: r.riskLevel,
        trend: r.trend,
        distributor: r.distributor,
        unitPrice: r.product.purchasePrice,
      })));
    } catch (err) { next(err); }
  },

  async productDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const days = Number(req.query.days ?? 30);
      const a = await inventoryIntelligence.analyzeProduct(req.params.id, days);
      if (!a) {
        res.status(404).json({ error: "Product not found or inactive" });
        return;
      }
      res.json(a);
    } catch (err) { next(err); }
  },

  /**
   * Persisted AI recommendations. Optional ?status=NEW|ACTIVE|ACKNOWLEDGED|DISMISSED|EXPIRED
   * and ?limit filters. This is the persisted Phase D view; the live reorder-candidate
   * analysis is available via GET /reorder-candidates.
   */
  async recommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const limit = Number(req.query.limit ?? 100);
      const rows = await recommendationService.list({
        status: status as never,
        limit: Math.min(limit, 500),
      });
      res.json(rows);
    } catch (err) { next(err); }
  },

  /** Persisted recommendations summary (counts by status). */
  async recommendationsSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await recommendationService.summary());
    } catch (err) { next(err); }
  },

  /**
   * Run the generation pass: analyze all active products and persist fresh
   * recommendations, superseding previous NEW/ACTIVE rows. Deterministic and
   * idempotent in effect (each run supersedes prior ones). Human-triggered; the
   * scheduled worker calls the same service.
   */
  async runRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const days = Number(req.body?.days ?? 30);
      const created = await recommendationService.generate(days);
      res.json({ created, at: new Date().toISOString() });
    } catch (err) { next(err); }
  },

  /** Human action: acknowledge a recommendation. */
  async acknowledgeRecommendation(req: Request, res: Response, next: NextFunction) {
    try {
      const rec = await recommendationService.acknowledge(
        req.params.id,
        (req as Request & { user?: { userId: string } }).user?.userId ?? "",
      );
      res.json(rec);
    } catch (err) { next(err); }
  },

  /** Human action: dismiss a recommendation. */
  async dismissRecommendation(req: Request, res: Response, next: NextFunction) {
    try {
      const rec = await recommendationService.dismiss(
        req.params.id,
        (req as Request & { user?: { userId: string } }).user?.userId ?? "",
      );
      res.json(rec);
    } catch (err) { next(err); }
  },

  /** Live reorder candidates from the deterministic engine (no persistence). */
  async reorderCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const days = Number(req.query.days ?? 30);
      const rows = await inventoryIntelligence.getReorderCandidates(days);
      res.json(rows.map((r) => ({
        productId: r.product.id,
        name: r.product.name,
        barcode: r.product.barcode,
        currentStock: r.currentStock,
        averageDailySales: r.averageDailySales,
        stockCoverageDays: r.stockCoverageDays,
        estimatedStockoutDays: r.estimatedStockoutDays,
        leadTimeDays: r.leadTimeDays,
        reorderPoint: r.reorderPoint,
        recommendedQuantity: r.recommendedQuantity,
        recommendedQuantityPacked: r.recommendedQuantityPacked,
        riskLevel: r.riskLevel,
        distributor: r.distributor,
      })));
    } catch (err) { next(err); }
  },

  async critical(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await inventoryIntelligence.getProductsByRisk("CRITICAL", 200);
      res.json(rows);
    } catch (err) { next(err); }
  },

  async overstock(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await inventoryIntelligence.getOverstock(200, 30);
      res.json(rows);
    } catch (err) { next(err); }
  },

  async slowMoving(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await inventoryIntelligence.getSlowMoving(1, 90, 200, 30);
      res.json(rows);
    } catch (err) { next(err); }
  },

  async expiry(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntelligence.getExpiryAnalysis();
      const serialize = (rows: Awaited<ReturnType<typeof inventoryIntelligence.getExpiryAnalysis>>["expired"]) =>
        rows.map((r) => ({
          productId: r.product.id,
          name: r.product.name,
          barcode: r.product.barcode,
          expiry: r.product.expiry,
          currentStock: r.currentStock,
        }));
      res.json({
        counts: result.counts,
        expired: serialize(result.expired),
        expiresIn30Days: serialize(result.expiresIn30Days),
        expiresIn60Days: serialize(result.expiresIn60Days),
        expiresIn90Days: serialize(result.expiresIn90Days),
      });
    } catch (err) { next(err); }
  },

  async dataQuality(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await inventoryIntelligence.getDataQuality(30));
    } catch (err) { next(err); }
  },
};