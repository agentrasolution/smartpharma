import type { AgentTool, ToolContext, ToolResult } from "./tool.types";
import { ok, fail } from "./tool.types";
import { inventoryIntelligence } from "../../inventory/inventory.service";
import { analyzeExpiry } from "../../inventory/expiry.service";
import {
  purchaseOrderService,
  roleHasPermission,
} from "../../modules/purchase-orders/purchase-order.service";
import { inventoryRepository } from "../../inventory/repository";
import { prisma } from "../../services/prisma";

function requirePermission(context: ToolContext, permission: string): ToolResult<null> | null {
  const has = roleHasPermission(context.role, permission);
  if (!has) {
    return fail("PERMISSION_DENIED", `Missing required permission: ${permission}`);
  }
  return null;
}

function parseDays(input: Record<string, unknown>): number {
  const d = Number(input.days ?? 30);
  return d > 0 && d <= 365 ? d : 30;
}

// Helper to avoid exposing unnecessary sensitive data (spec #80).
function toSummary(a: import("../../inventory/inventory.service").ProductAnalysis) {
  return {
    productId: a.product.id,
    name: a.product.name,
    barcode: a.product.barcode,
    category: a.product.category,
    currentStock: a.currentStock,
    averageDailySales: a.averageDailySales,
    stockCoverageDays: a.stockCoverageDays,
    estimatedStockoutDays: a.estimatedStockoutDays,
    leadTimeDays: a.leadTimeDays,
    reorderPoint: a.reorderPoint,
    recommendedQuantity: a.recommendedQuantity,
    recommendedQuantityPacked: a.recommendedQuantityPacked,
    riskLevel: a.riskLevel,
    distributor: a.distributor ? { id: a.distributor.id, name: a.distributor.name, leadTimeDays: a.distributor.leadTimeDays } : null,
    unitPrice: a.product.purchasePrice,
  };
}

export const inventoryTools: AgentTool[] = [
  {
    name: "get_inventory_summary",
    description:
      "Get overall inventory health summary: total products and counts of critical, high, medium, healthy and overstock products.",
    inputSchema: { type: "object", properties: { days: { type: "integer", description: "Analysis window. Default 30." } } },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      try {
        return ok(await inventoryIntelligence.getSummary(parseDays(input)));
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_inventory_products",
    description:
      "Get products filtered by risk level (CRITICAL, HIGH, MEDIUM, HEALTHY, OVERSTOCK). Returns structured inventory data.",
    inputSchema: {
      type: "object",
      properties: {
        riskLevel: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "HEALTHY", "OVERSTOCK"] },
        limit: { type: "integer", description: "Max results. Default 20." },
        days: { type: "integer" },
      },
      required: ["riskLevel"],
    },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      const riskLevel = String(input.riskLevel ?? "CRITICAL") as never;
      const limit = Math.min(Number(input.limit ?? 20), 200);
      try {
        const rows = await inventoryIntelligence.getProductsByRisk(riskLevel, limit, parseDays(input));
        return ok(rows.map(toSummary));
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_product_inventory",
    description:
      "Get detailed inventory status for a single product: stock, prices, distributor, expiry and pack size.",
    inputSchema: { type: "object", properties: { productId: { type: "string" } }, required: ["productId"] },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      const productId = String(input.productId ?? "");
      if (!productId) return fail("INVALID_INPUT", "productId is required");
      try {
        const a = await inventoryIntelligence.analyzeProduct(productId, 30);
        if (!a) return fail("PRODUCT_NOT_FOUND", "Product not found or inactive");
        return ok({
          product: a.product,
          currentStock: a.currentStock,
          purchasePrice: a.product.purchasePrice,
          salePrice: a.product.salePrice,
          distributor: a.distributor,
          expiry: analyzeExpiry(a.product.expiry),
          packSize: a.product.packSize,
        });
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_sales_history",
    description:
      "Get sales history for a product: total sold, total returned, net sold and average daily sales over a window.",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "string" }, days: { type: "integer" } },
      required: ["productId"],
    },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      const productId = String(input.productId ?? "");
      const days = parseDays(input);
      if (!productId) return fail("INVALID_INPUT", "productId is required");
      try {
        const since = new Date(Date.now() - days * 86400000);
        const hist = await inventoryRepository.getSalesHistory(productId, since, ["paid"]);
        const product = await inventoryRepository.getProduct(productId);
        if (!product) return fail("PRODUCT_NOT_FOUND", "Product not found or inactive");
        const net = hist.totalSold - hist.totalReturned;
        const avg = days > 0 ? net / days : 0;
        return ok({
          productId,
          productName: product.name,
          totalSold: hist.totalSold,
          totalReturned: hist.totalReturned,
          netSold: net > 0 ? net : 0,
          averageDailySales: Math.round((avg + Number.EPSILON) * 100) / 100,
          days,
        });
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_today_sales_summary",
    description:
      "Get today's sales summary: number of paid sales, total revenue, discount and a list of the most sold products for today.",
    inputSchema: { type: "object", properties: {} },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [salesAgg, items, byProduct] = await Promise.all([
          prisma.sale.aggregate({
            where: { createdAt: { gte: today }, status: { in: ["paid"] } },
            _sum: { total: true, subtotal: true, discount: true },
            _count: true,
          }),
          prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: today }, status: { in: ["paid"] } } },
            select: { productName: true, quantity: true },
          }),
          prisma.saleItem.groupBy({
            by: ["productName"],
            where: { sale: { createdAt: { gte: today }, status: { in: ["paid"] } } },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: 10,
          }),
        ]);
        return ok({
          date: today.toLocaleDateString("en-CA"),
          salesCount: salesAgg._count,
          totalRevenue: Math.round(((salesAgg._sum.total ?? 0) + Number.EPSILON) * 100) / 100,
          totalDiscount: Math.round(((salesAgg._sum.discount ?? 0) + Number.EPSILON) * 100) / 100,
          unitsSold: items.reduce((n, it) => n + it.quantity, 0),
          topProducts: byProduct.map((p) => ({
            product: p.productName,
            units: p._sum.quantity ?? 0,
          })),
        });
      } catch (err) {
        return fail("SALES_SUMMARY_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "analyze_product_inventory",
    description:
      "Full inventory analysis for one product: stock, net sales, average daily sales, stock coverage, stockout estimate, lead time demand, safety stock, reorder point, target stock, recommended quantity and risk level.",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "string" }, days: { type: "integer" } },
      required: ["productId"],
    },
    permission: "ANALYZE_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "ANALYZE_INVENTORY");
      if (denied) return denied;
      const productId = String(input.productId ?? "");
      if (!productId) return fail("INVALID_INPUT", "productId is required");
      try {
        const a = await inventoryIntelligence.analyzeProduct(productId, parseDays(input));
        if (!a) return fail("PRODUCT_NOT_FOUND", "Product not found or inactive");
        return ok({
          productId: a.product.id,
          name: a.product.name,
          barcode: a.product.barcode,
          currentStock: a.currentStock,
          netSold: a.netSold,
          averageDailySales: a.averageDailySales,
          stockCoverageDays: a.stockCoverageDays,
          estimatedStockoutDays: a.estimatedStockoutDays,
          leadTimeDays: a.leadTimeDays,
          leadTimeDemand: a.leadTimeDemand,
          safetyStock: a.safetyStock,
          reorderPoint: a.reorderPoint,
          targetStock: a.targetStock,
          recommendedQuantity: a.recommendedQuantity,
          recommendedQuantityPacked: a.recommendedQuantityPacked,
          riskLevel: a.riskLevel,
          distributor: a.distributor,
        });
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_reorder_candidates",
    description:
      "Find products at or below reorder point, or whose estimated stockout day is before supplier lead time. Returns products requiring attention with stock, daily sales, coverage and recommended quantity.",
    inputSchema: { type: "object", properties: { days: { type: "integer", description: "Analysis window in days (7-90). Default 30." } } },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx: ToolContext, input: Record<string, unknown>): Promise<ToolResult<unknown>> {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      try {
        const candidates = await inventoryIntelligence.getReorderCandidates(parseDays(input));
        return ok(candidates.map(toSummary));
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_slow_moving_products",
    description:
      "Find slow-moving products: very low average daily sales with significant stock (overstock risk). Thresholds configurable.",
    inputSchema: {
      type: "object",
      properties: {
        lowDailySales: { type: "number", description: "Max avg daily sales to be considered slow. Default 1." },
        highCoverageDays: { type: "integer", description: "Min stock coverage days. Default 90." },
        limit: { type: "integer" },
      },
    },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      try {
        const rows = await inventoryIntelligence.getSlowMoving(
          Number(input.lowDailySales ?? 1),
          Number(input.highCoverageDays ?? 90),
          Math.min(Number(input.limit ?? 50), 200),
        );
        return ok(rows.map(toSummary));
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_overstock_products",
    description: "Find products with excessive stock coverage (overstock), e.g. > 90 days. Threshold configurable.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer" }, days: { type: "integer" } },
    },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      try {
        const rows = await inventoryIntelligence.getOverstock(Math.min(Number(input.limit ?? 50), 200), parseDays(input));
        return ok(rows.map(toSummary));
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_expiry_analysis",
    description:
      "Expiry analysis across all active products: expired, expires in 30/60/90 days, and invalid/empty expiry values.",
    inputSchema: { type: "object", properties: {} },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      try {
        const result = await inventoryIntelligence.getExpiryAnalysis();
        const serialize = (rows: import("../../inventory/inventory.service").ProductAnalysis[]) =>
          rows.map((r) => ({
            productId: r.product.id,
            name: r.product.name,
            barcode: r.product.barcode,
            expiry: r.product.expiry,
            currentStock: r.currentStock,
          }));
        return ok({
          counts: result.counts,
          expired: serialize(result.expired).slice(0, 50),
          expiresIn30Days: serialize(result.expiresIn30Days).slice(0, 50),
          expiresIn60Days: serialize(result.expiresIn60Days).slice(0, 50),
          expiresIn90Days: serialize(result.expiresIn90Days).slice(0, 50),
        });
      } catch (err) {
        return fail("INVENTORY_ANALYSIS_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_distributor",
    description: "Get distributor/supplier information: name, phone, address, lead time and minimum order value.",
    inputSchema: { type: "object", properties: { distributorId: { type: "string" } }, required: ["distributorId"] },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      const id = String(input.distributorId ?? "");
      if (!id) return fail("INVALID_INPUT", "distributorId is required");
      try {
        const d = await inventoryRepository.getDistributor(id);
        if (!d) return fail("DISTRIBUTOR_NOT_FOUND", "Distributor not found");
        return ok({
          id: d.id,
          name: d.name,
          phone: d.phone,
          address: d.address,
          leadTimeDays: d.leadTimeDays,
          minimumOrderValue: d.minimumOrderValue,
        });
      } catch (err) {
        return fail("DISTRIBUTOR_LOOKUP_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_purchase_history",
    description: "Get recent stock (purchase) history for a product: date, quantity, purchase price, distributor and expiry.",
    inputSchema: { type: "object", properties: { productId: { type: "string" } }, required: ["productId"] },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      const id = String(input.productId ?? "");
      if (!id) return fail("INVALID_INPUT", "productId is required");
      try {
        const history = await inventoryRepository.getPurchaseHistory(id);
        return ok(history);
      } catch (err) {
        return fail("PURCHASE_HISTORY_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "create_purchase_order_draft",
    description:
      "Create a DRAFT purchase order for a distributor. Validates products, quantities and prices server-side, calculates totals, and creates the draft. Drafts require human approval before becoming purchases. Use idempotencyKey to avoid duplicates.",
    inputSchema: {
      type: "object",
      properties: {
        distributorId: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productId: { type: "string" },
              quantity: { type: "integer" },
              unitPrice: { type: "number", description: "Optional; defaults to product purchase price." },
            },
            required: ["productId", "quantity"],
          },
        },
        notes: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["distributorId", "items"],
    },
    permission: "CREATE_PURCHASE_DRAFT",
    requiresApproval: true,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "CREATE_PURCHASE_DRAFT");
      if (denied) return denied;
      const distributorId = String(input.distributorId ?? "");
      const itemsRaw = Array.isArray(input.items) ? input.items : [];
      const items = itemsRaw.map((i) => ({
        productId: String((i as Record<string, unknown>).productId ?? ""),
        quantity: Number((i as Record<string, unknown>).quantity ?? 0),
        unitPrice: (i as Record<string, unknown>).unitPrice != null
          ? Number((i as Record<string, unknown>).unitPrice)
          : undefined,
      }));
      if (!distributorId || items.length === 0) {
        return fail("INVALID_INPUT", "distributorId and at least one item are required");
      }
      try {
        const order = await purchaseOrderService.createDraft(
          {
            distributorId,
            items,
            notes: input.notes != null ? String(input.notes) : "Prepared by AI Inventory Agent",
            idempotencyKey: input.idempotencyKey != null ? String(input.idempotencyKey) : undefined,
          },
          { userId: ctx.userId ?? "", role: ctx.role },
        );
        return ok({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          distributor: { id: order.distributor.id, name: order.distributor.name },
          subtotal: order.subtotal,
          total: order.total,
          items: order.items.map((i) => ({
            productId: i.productId,
            productName: (i as unknown as { product?: { name?: string } }).product?.name ?? null,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        });
      } catch (err) {
        return fail("PURCHASE_ORDER_CREATE_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "submit_purchase_order_for_approval",
    description:
      "Submit a DRAFT purchase order for human approval. Changes status to PENDING_APPROVAL. This does NOT approve it.",
    inputSchema: { type: "object", properties: { purchaseOrderId: { type: "string" } }, required: ["purchaseOrderId"] },
    permission: "SUBMIT_PURCHASE",
    requiresApproval: false,
    async execute(ctx, input) {
      const denied = requirePermission(ctx, "SUBMIT_PURCHASE");
      if (denied) return denied;
      const id = String(input.purchaseOrderId ?? "");
      if (!id) return fail("INVALID_INPUT", "purchaseOrderId is required");
      try {
        const order = await purchaseOrderService.submitForApproval(id, { userId: ctx.userId ?? "", role: ctx.role });
        return ok({ id: order.id, orderNumber: order.orderNumber, status: order.status });
      } catch (err) {
        return fail("PURCHASE_ORDER_SUBMIT_FAILED", (err as Error).message);
      }
    },
  },
  {
    name: "get_data_quality",
    description:
      "Report data-quality issues in the product catalog: negative stock, zero prices, missing distributors, invalid expiry and zero sales products.",
    inputSchema: { type: "object", properties: {} },
    permission: "READ_INVENTORY",
    requiresApproval: false,
    async execute(ctx) {
      const denied = requirePermission(ctx, "READ_INVENTORY");
      if (denied) return denied;
      try {
        const q = await inventoryIntelligence.getDataQuality();
        return ok(q);
      } catch (err) {
        return fail("DATA_QUALITY_FAILED", (err as Error).message);
      }
    },
  },
];