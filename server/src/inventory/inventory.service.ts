import { inventoryRepository as repo } from "./repository";
import { InventoryAnalysisService } from "./analytics.service";
import { analyzeExpiry, expiryBucketedCounts, type ExpiryInfo } from "./expiry.service";
import { classifyTrend } from "./trend.service";
import type { RiskLevel } from "./math";
import type { BranchScope } from "../middleware/auth";

const VALID_SALE_STATUSES = ["paid"];

export interface ProductAnalysis {
  product: {
    id: string;
    barcode: string;
    name: string;
    category: string;
    company: string;
    location: string;
    purchasePrice: number;
    salePrice: number;
    packSize: number;
    expiry: string | null;
  };
  currentStock: number;
  netSold: number;
  averageDailySales: number;
  stockCoverageDays: number | null;
  estimatedStockoutDays: number | null;
  leadTimeDays: number | null;
  leadTimeDemand: number;
  safetyStock: number;
  reorderPoint: number;
  targetStock: number;
  recommendedQuantity: number;
  recommendedQuantityPacked: number;
  riskLevel: RiskLevel;
  trend: "INCREASING" | "STABLE" | "DECREASING" | null;
  distributor: { id: string; name: string; leadTimeDays: number } | null;
  expiryInfo: ExpiryInfo;
}

const analysisService = new InventoryAnalysisService({
  defaultSafetyStockDays: 2,
  defaultTargetStockDays: 14,
  lowStockThreshold: 10,
  overstockCoverageDays: 90,
});

export class InventoryIntelligenceService {
  private async baseConfig() {
    const cfg = await repo.getConfig();
    return new InventoryAnalysisService({
      defaultSafetyStockDays: cfg.defaultSafetyStockDays,
      defaultTargetStockDays: cfg.defaultTargetStockDays,
      lowStockThreshold: cfg.lowStockThreshold,
      overstockCoverageDays: cfg.overstockCoverageDays,
    });
  }

  /** Analyze a single product (Tool: analyze_product_inventory). */
  async analyzeProduct(scope: BranchScope, productId: string, days = 30): Promise<ProductAnalysis | null> {
    const product = await repo.getProduct(productId, scope);
    if (!product || product.active !== 1) return null;

    const effectiveDays = days > 0 ? days : 30;
    const since = new Date(Date.now() - effectiveDays * 86400000);
    const distributorPromise = product.distributorId
      ? repo.getDistributor(product.distributorId, scope).then((d) => ({
          id: d?.id ?? "",
          name: d?.name ?? "",
          leadTimeDays: d?.leadTimeDays ?? 3,
        }))
      : Promise.resolve(null);
    const [sales, leadTimeDays, distributor] = await Promise.all([
      repo.getNetSalesStatForProduct(productId, since, VALID_SALE_STATUSES, scope),
      repo.getEffectiveLeadTime(productId, product.distributorId),
      distributorPromise,
    ]);

    const svc = await this.baseConfig();
    const result = svc.analyzeSingle({
      currentStock: product.stockQty,
      netSold: sales.net,
      analysisDays: effectiveDays,
      leadTimeDays: leadTimeDays ?? 3,
      packSize: product.packSize,
    });

    return {
      product: {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        category: product.category,
        company: product.company,
        location: product.location,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        packSize: product.packSize,
        expiry: product.expiry,
      },
      currentStock: result.currentStock,
      netSold: result.netSold,
      averageDailySales: result.averageDailySales,
      stockCoverageDays: result.stockCoverageDays,
      estimatedStockoutDays: result.estimatedStockoutDays,
      leadTimeDays,
      leadTimeDemand: result.leadTimeDemand,
      safetyStock: result.safetyStock,
      reorderPoint: result.reorderPoint,
      targetStock: result.targetStock,
      recommendedQuantity: result.recommendedQuantity,
      recommendedQuantityPacked: result.recommendedQuantityPacked,
      riskLevel: result.riskLevel,
      trend: null,
      distributor,
      expiryInfo: analyzeExpiry(product.expiry),
    };
  }

  /** Analyze many products efficiently (single aggregated sales pass). */
  async analyzeMany(scope: BranchScope, productIds: string[] | null, days = 30): Promise<ProductAnalysis[]> {
    const products = productIds && productIds.length > 0
      ? await repo.getProductsByIds(productIds, scope)
      : await repo.getActiveProducts(scope);

    const effectiveDays = days > 0 ? days : 30;
    const since = new Date(Date.now() - effectiveDays * 86400000);
    const stats = await repo.getNetSalesStats(since, VALID_SALE_STATUSES, scope);
    const statMap = new Map(stats.map((s) => [s.productId, s]));
    const cfg = await repo.getConfig();
    const svc = new InventoryAnalysisService({
      defaultSafetyStockDays: cfg.defaultSafetyStockDays,
      defaultTargetStockDays: cfg.defaultTargetStockDays,
      lowStockThreshold: cfg.lowStockThreshold,
      overstockCoverageDays: cfg.overstockCoverageDays,
    });
    const distributors = await repo.getDistributors(scope);
    const distMap = new Map(distributors.map((d) => [d.id, d]));

    // Every active product that has a distributor -> resolve lead times in bulk.
    const pairs = new Map<string, string>();
    for (const p of products) {
      if (p.distributorId) pairs.set(p.id, p.distributorId);
    }
    const leadTimes = await repo.getEffectiveLeadTimes(pairs);

    const analyses: ProductAnalysis[] = [];
    for (const p of products) {
      const s = statMap.get(p.id);
      const netSold = s?.net ?? 0;
      const leadTimeDays = p.distributorId ? leadTimes.get(p.id) ?? null : null;
      const result = svc.analyzeSingle({
        currentStock: p.stockQty,
        netSold,
        analysisDays: effectiveDays,
        leadTimeDays: leadTimeDays ?? 3,
        packSize: p.packSize,
      });
      const dist = p.distributorId ? distMap.get(p.distributorId) : undefined;
      analyses.push({
        product: {
          id: p.id,
          barcode: p.barcode,
          name: p.name,
          category: p.category,
          company: p.company,
          location: p.location,
          purchasePrice: p.purchasePrice,
          salePrice: p.salePrice,
          packSize: p.packSize,
          expiry: p.expiry,
        },
        currentStock: result.currentStock,
        netSold: result.netSold,
        averageDailySales: result.averageDailySales,
        stockCoverageDays: result.stockCoverageDays,
        estimatedStockoutDays: result.estimatedStockoutDays,
        leadTimeDays,
        leadTimeDemand: result.leadTimeDemand,
        safetyStock: result.safetyStock,
        reorderPoint: result.reorderPoint,
        targetStock: result.targetStock,
        recommendedQuantity: result.recommendedQuantity,
        recommendedQuantityPacked: result.recommendedQuantityPacked,
        riskLevel: result.riskLevel,
        trend: null,
        distributor: dist ? { id: dist.id, name: dist.name, leadTimeDays: dist.leadTimeDays } : null,
        expiryInfo: analyzeExpiry(p.expiry),
      });
    }
    return analyses;
  }

  /** Inventory summary (Tool: get_inventory_summary). */
  async getSummary(scope: BranchScope, days = 30): Promise<{
    totalProducts: number;
    critical: number;
    high: number;
    medium: number;
    healthy: number;
    overstock: number;
  }> {
    const analyses = await this.analyzeMany(scope, null, days);
    const summary = { totalProducts: analyses.length, critical: 0, high: 0, medium: 0, healthy: 0, overstock: 0 };
    for (const a of analyses) {
      if (a.riskLevel === "CRITICAL") summary.critical++;
      else if (a.riskLevel === "HIGH") summary.high++;
      else if (a.riskLevel === "MEDIUM") summary.medium++;
      else if (a.riskLevel === "OVERSTOCK") summary.overstock++;
      else summary.healthy++;
    }
    return summary;
  }

  /** Products filtered by risk level (Tool: get_inventory_products). */
  async getProductsByRisk(scope: BranchScope, riskLevel: RiskLevel, limit = 20, days = 30): Promise<ProductAnalysis[]> {
    const analyses = await this.analyzeMany(scope, null, days);
    return analyses.filter((a) => a.riskLevel === riskLevel).slice(0, limit);
  }

  /** Products at or below reorder point, or stockout before lead time. */
  async getReorderCandidates(scope: BranchScope, days = 30): Promise<ProductAnalysis[]> {
    const analyses = await this.analyzeMany(scope, null, days);
    return analyses
      .filter((a) => {
        if (a.riskLevel === "CRITICAL" || a.riskLevel === "HIGH") return true;
        const covered = a.stockCoverageDays !== null && a.leadTimeDays !== null
          && a.stockCoverageDays < a.leadTimeDays;
        return covered;
      })
      .slice(0, 100);
  }

  /** Slow-moving products: very low daily sales with significant stock. */
  async getSlowMoving(scope: BranchScope, lowDailySales = 1, highCoverageDays = 90, limit = 50, days = 30): Promise<ProductAnalysis[]> {
    const analyses = await this.analyzeMany(scope, null, days);
    return analyses
      .filter((a) => {
        if (a.averageDailySales <= 0) return false;
        if (a.averageDailySales > lowDailySales) return false;
        if (a.stockCoverageDays === null || a.stockCoverageDays < highCoverageDays) return false;
        return a.riskLevel !== "CRITICAL" && a.riskLevel !== "HIGH";
      })
      .slice(0, limit);
  }

  /** Overstock products: coverage exceeds threshold. */
  async getOverstock(scope: BranchScope, limit = 50, days = 30): Promise<ProductAnalysis[]> {
    const analyses = await this.analyzeMany(scope, null, days);
    return analyses.filter((a) => a.riskLevel === "OVERSTOCK").slice(0, limit);
  }

  /** Expiry analysis across all active products. */
  async getExpiryAnalysis(scope: BranchScope): Promise<{
    counts: ReturnType<typeof expiryBucketedCounts>;
    expired: ProductAnalysis[];
    expiresIn30Days: ProductAnalysis[];
    expiresIn60Days: ProductAnalysis[];
    expiresIn90Days: ProductAnalysis[];
  }> {
    const analyses = await this.analyzeMany(scope, null, 30);
    const expired = analyses.filter((a) => a.expiryInfo.bucket === "EXPIRED");
    const expiresIn30Days = analyses.filter((a) => a.expiryInfo.bucket === "EXPIRES_IN_30_DAYS");
    const expiresIn60Days = analyses.filter((a) => a.expiryInfo.bucket === "EXPIRES_IN_60_DAYS");
    const expiresIn90Days = analyses.filter((a) => a.expiryInfo.bucket === "EXPIRES_IN_90_DAYS");
    const counts = expiryBucketedCounts(analyses.map((a) => a.expiryInfo));
    return { counts, expired, expiresIn30Days, expiresIn60Days, expiresIn90Days };
  }

  /** Trend for a single product (recent 7 vs previous 7 days). */
  async getTrend(scope: BranchScope, productId: string, thresholdPercent = 15): Promise<"INCREASING" | "STABLE" | "DECREASING" | null> {
    const now = Date.now();
    const recentSince = new Date(now - 7 * 86400000);
    const previousSince = new Date(now - 14 * 86400000);
    const [recent, previous] = await Promise.all([
      repo.getNetSalesStatForProduct(productId, recentSince, VALID_SALE_STATUSES, scope),
      repo.getNetSalesStatForProduct(productId, previousSince, VALID_SALE_STATUSES, scope),
    ]);
    const trend = classifyTrend(recent.net, previous.net, thresholdPercent);
    return trend.direction;
  }

  /** Data-quality issues across active products. */
  async getDataQuality(scope: BranchScope, days = 30): Promise<{
    negativeStock: number;
    zeroPrice: number;
    missingDistributor: number;
    invalidExpiry: number;
    zeroSales: number;
    inactiveProducts: number;
    activeProducts: number;
  }> {
    const products = await repo.getActiveProducts(scope);
    const totalProducts = await repo.getTotalProductCount(scope);
    const analyses = await this.analyzeMany(scope, null, days);
    const activeIds = new Set(products.map((p) => p.id));
    let negativeStock = 0;
    let zeroPrice = 0;
    let missingDistributor = 0;
    let invalidExpiry = 0;
    let zeroSales = 0;
    for (const p of products) {
      if (p.stockQty < 0) negativeStock++;
      if (p.purchasePrice <= 0 || p.salePrice <= 0) zeroPrice++;
      if (!p.distributorId) missingDistributor++;
      if (analyzeExpiry(p.expiry).status === "INVALID") invalidExpiry++;
    }
    for (const a of analyses) {
      if (a.netSold <= 0) zeroSales++;
    }
    return {
      negativeStock,
      zeroPrice,
      missingDistributor,
      invalidExpiry,
      zeroSales,
      inactiveProducts: totalProducts - activeIds.size,
      activeProducts: activeIds.size,
    };
  }
}

export const inventoryIntelligence = new InventoryIntelligenceService();