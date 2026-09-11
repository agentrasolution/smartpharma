import { prisma } from "../services/prisma";
import { inventoryIntelligence, type ProductAnalysis } from "./inventory.service";

// Recommendation lifecycle:
// NEW -> ACKNOWLEDGED (human) | DISMISSED (human) | EXPIRED (superseded)
export const RECOMMENDATION_STATUS = {
  NEW: "NEW",
  ACTIVE: "ACTIVE",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  DISMISSED: "DISMISSED",
  EXPIRED: "EXPIRED",
} as const;

export type RecommendationStatus =
  (typeof RECOMMENDATION_STATUS)[keyof typeof RECOMMENDATION_STATUS];

const ACTIVE_STATUSES: RecommendationStatus[] = ["NEW", "ACTIVE"];

/** Build a human-readable reason string from the analysis. */
function buildReason(a: ProductAnalysis): string {
  const name = a.product.name;
  if (a.riskLevel === "CRITICAL") {
    const stockout = a.estimatedStockoutDays != null ? `stockout expected in ~${a.estimatedStockoutDays} day(s)` : "stock out imminent";
    const lead = a.leadTimeDays != null ? ` before supplier lead time of ${a.leadTimeDays} day(s)` : "";
    return `${name} is at risk of stockout (${stockout}${lead}). Order ${a.recommendedQuantity} unit(s) (${a.recommendedQuantityPacked} in packs of ${a.product.packSize}) to reach target stock of ${a.targetStock}.`;
  }
  if (a.riskLevel === "HIGH") {
    return `${name} is at or below its reorder point (${a.reorderPoint}). Order ${a.recommendedQuantity} unit(s) to reach target stock of ${a.targetStock}.`;
  }
  if (a.riskLevel === "OVERSTOCK") {
    return `${name} has excess stock covering ~${a.stockCoverageDays} day(s) of sales (threshold ${90} days). Consider reducing the next order.`;
  }
  if (a.riskLevel === "MEDIUM" && a.recommendedQuantity > 0) {
    return `${name} is low on stock. Order ${a.recommendedQuantity} unit(s) to reach target stock of ${a.targetStock}.`;
  }
  return `${name} inventory review: coverage ${a.stockCoverageDays ?? "n/a"} day(s), daily sales ${a.averageDailySales}.`;
}

function isActionable(a: ProductAnalysis): boolean {
  if (a.riskLevel === "CRITICAL" || a.riskLevel === "HIGH") return true;
  if (a.riskLevel === "OVERSTOCK") return true;
  return a.riskLevel === "MEDIUM" && a.recommendedQuantity > 0;
}

function buildRecommendationRow(a: ProductAnalysis) {
  return {
    productId: a.product.id,
    distributorId: a.distributor?.id ?? null,
    riskLevel: a.riskLevel,
    currentStock: a.currentStock,
    averageDailySales: a.averageDailySales,
    stockCoverageDays: a.stockCoverageDays,
    estimatedStockoutDays: a.estimatedStockoutDays,
    leadTimeDays: a.leadTimeDays,
    reorderPoint: a.reorderPoint,
    recommendedQuantity: a.recommendedQuantity,
    reason: buildReason(a),
    status: RECOMMENDATION_STATUS.NEW,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  };
}

async function supersede(productIds: string[], now: Date): Promise<number> {
  if (productIds.length === 0) return 0;
  const result = await prisma.aIInventoryRecommendation.updateMany({
    where: {
      productId: { in: productIds },
      status: { in: [...ACTIVE_STATUSES] },
    },
    data: {
      status: RECOMMENDATION_STATUS.EXPIRED,
      expiresAt: now,
    },
  });
  return result.count;
}

export const recommendationService = {
  /**
   * Run a full analysis pass and persist recommendations for every product
   * that needs attention. Previous NEW/ACTIVE rows for those products are
   * superseded (status -> EXPIRED) so the UI always reflects current state.
   * Returns the number of recommendations persisted.
   */
  async generate(days = 30): Promise<number> {
    const analyses = await inventoryIntelligence.analyzeMany(null, days);
    const actionable = analyses.filter(isActionable);

    const now = new Date();
    const rows = actionable.map(buildRecommendationRow);
    const productIds = actionable.map((a) => a.product.id);

    let created = 0;
    if (rows.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.aIInventoryRecommendation.updateMany({
          where: {
            productId: { in: productIds },
            status: { in: [...ACTIVE_STATUSES] },
          },
          data: {
            status: RECOMMENDATION_STATUS.EXPIRED,
            expiresAt: now,
          },
        });
        const res = await tx.aIInventoryRecommendation.createMany({ data: rows });
        created = res.count;
      });
    }
    return created;
  },

  /** Expire stale active recommendations older than the freshness window. */
  async expireStale(maxAgeMs = 7 * 86400000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await prisma.aIInventoryRecommendation.updateMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        createdAt: { lt: cutoff },
      },
      data: { status: RECOMMENDATION_STATUS.EXPIRED, expiresAt: new Date() },
    });
    return result.count;
  },

  async list(opts?: {
    status?: RecommendationStatus | RecommendationStatus[];
    limit?: number;
  }): Promise<Awaited<ReturnType<typeof prisma.aIInventoryRecommendation.findMany>>> {
    const statuses = opts?.status
      ? (Array.isArray(opts.status) ? opts.status : [opts.status]) as string[]
      : undefined;
    return prisma.aIInventoryRecommendation.findMany({
      where: statuses ? { status: { in: statuses } } : {},
      orderBy: [{ riskLevel: "asc" as const }, { createdAt: "desc" as const }],
      take: opts?.limit ?? 100,
      include: {
        product: { select: { id: true, name: true, barcode: true, category: true } },
      },
    });
  },

  /** Counts by status, used for the recommendation dashboard tiles. */
  async summary(): Promise<Record<string, number>> {
    const rows = await prisma.aIInventoryRecommendation.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const out: Record<string, number> = {
      NEW: 0,
      ACTIVE: 0,
      ACKNOWLEDGED: 0,
      DISMISSED: 0,
      EXPIRED: 0,
    };
    for (const r of rows) out[r.status] = r._count._all;
    return out;
  },

  /**
   * Human action: acknowledge a recommendation. Human-only operation; the AI
   * agent never writes recommendations to non-NEW states.
   */
  async acknowledge(id: string, actorUserId: string): Promise<unknown> {
    const rec = await prisma.aIInventoryRecommendation.update({
      where: { id },
      data: { status: RECOMMENDATION_STATUS.ACKNOWLEDGED },
    });
    void actorUserId;
    return rec;
  },

  /** Human action: dismiss (reject) a recommendation. */
  async dismiss(id: string, actorUserId: string): Promise<unknown> {
    const rec = await prisma.aIInventoryRecommendation.update({
      where: { id },
      data: { status: RECOMMENDATION_STATUS.DISMISSED },
    });
    void actorUserId;
    return rec;
  },
};