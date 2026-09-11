import { prisma } from "../services/prisma";

// Aggregated, performant data access for the inventory intelligence engine.
// All queries here are company-agnostic (single-pharmacy POS) but structured so
// a `companyId` filter can be added without rewriting the agent.

export interface ProductRef {
  id: string;
  barcode: string;
  name: string;
  company: string;
  category: string;
  location: string;
  distributorId: string | null;
  salePrice: number;
  purchasePrice: number;
  stockQty: number;
  expiry: string | null;
  packSize: number;
  active: number;
}

export interface DistributorRef {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  companyId: string | null;
  leadTimeDays: number;
  minimumOrderValue: number;
}

export interface NetSalesStat {
  productId: string;
  totalSold: number;
  totalReturned: number;
  net: number;
}

export const inventoryRepository = {
  async getConfig(): Promise<{
    defaultSafetyStockDays: number;
    defaultTargetStockDays: number;
    defaultAnalysisDays: number;
    lowStockThreshold: number;
    overstockCoverageDays: number;
    trendThresholdPercent: number;
  }> {
    const cfg = await prisma.inventoryConfig.findFirst();
    return {
      defaultSafetyStockDays: cfg?.defaultSafetyStockDays ?? 2,
      defaultTargetStockDays: cfg?.defaultTargetStockDays ?? 14,
      defaultAnalysisDays: cfg?.defaultAnalysisDays ?? 30,
      lowStockThreshold: cfg?.lowStockThreshold ?? 10,
      overstockCoverageDays: cfg?.overstockCoverageDays ?? 90,
      trendThresholdPercent: cfg?.trendThresholdPercent ?? 15,
    };
  },

  async getActiveProducts(): Promise<ProductRef[]> {
    const products = await prisma.product.findMany({
      where: { active: 1 },
      select: {
        id: true,
        barcode: true,
        name: true,
        company: true,
        category: true,
        location: true,
        distributorId: true,
        salePrice: true,
        purchasePrice: true,
        stockQty: true,
        expiry: true,
        packSize: true,
        active: true,
      },
    });
    return products;
  },

  async getProductsByIds(ids: string[]): Promise<ProductRef[]> {
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        barcode: true,
        name: true,
        company: true,
        category: true,
        location: true,
        distributorId: true,
        salePrice: true,
        purchasePrice: true,
        stockQty: true,
        expiry: true,
        packSize: true,
        active: true,
      },
    });
    return products;
  },

  async getProduct(id: string): Promise<ProductRef | null> {
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        barcode: true,
        name: true,
        company: true,
        category: true,
        location: true,
        distributorId: true,
        salePrice: true,
        purchasePrice: true,
        stockQty: true,
        expiry: true,
        packSize: true,
        active: true,
      },
    });
    return p;
  },

  async getDistributor(id: string): Promise<DistributorRef | null> {
    const d = await prisma.distributor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        contact: true,
        phone: true,
        address: true,
        companyId: true,
        inventoryConfig: {
          select: { defaultLeadTimeDays: true, minimumOrderValue: true },
        },
      },
    });
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      contact: d.contact,
      phone: d.phone,
      address: d.address,
      companyId: d.companyId,
      leadTimeDays: d.inventoryConfig?.defaultLeadTimeDays ?? 3,
      minimumOrderValue: d.inventoryConfig?.minimumOrderValue ?? 0,
    };
  },

  async getDistributors(): Promise<DistributorRef[]> {
    const ds = await prisma.distributor.findMany({
      select: {
        id: true,
        name: true,
        contact: true,
        phone: true,
        address: true,
        companyId: true,
        inventoryConfig: {
          select: { defaultLeadTimeDays: true, minimumOrderValue: true },
        },
      },
    });
    return ds.map((d) => ({
      id: d.id,
      name: d.name,
      contact: d.contact,
      phone: d.phone,
      address: d.address,
      companyId: d.companyId,
      leadTimeDays: d.inventoryConfig?.defaultLeadTimeDays ?? 3,
      minimumOrderValue: d.inventoryConfig?.minimumOrderValue ?? 0,
    }));
  },

  async getEffectiveLeadTime(productId: string, distributorId: string | null): Promise<number | null> {
    if (!distributorId) return null;
    const leadTimes = await this.getEffectiveLeadTimes(new Map([[productId, distributorId]]));
    return leadTimes.get(productId) ?? null;
  },

  // Bulk lead-time resolution: per-product overrides first, then distributor
  // defaults, then a global default of 3 days. Avoids N+1 queries.
  async getEffectiveLeadTimes(productDistributorPairs: Map<string, string>): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (productDistributorPairs.size === 0) return result;

    const productIds = Array.from(productDistributorPairs.keys());
    const distributorIds = Array.from(productDistributorPairs.values());

    const [overrides, distConfigs] = await Promise.all([
      prisma.productDistributorConfig.findMany({
        where: {
          productId: { in: productIds },
          distributorId: { in: distributorIds },
        },
        select: { productId: true, leadTimeDays: true },
      }),
      prisma.distributorInventoryConfig.findMany({
        where: { distributorId: { in: distributorIds } },
        select: { distributorId: true, defaultLeadTimeDays: true },
      }),
    ]);

    const overrideMap = new Map(overrides.filter((o) => o.leadTimeDays != null).map((o) => [o.productId, o.leadTimeDays!]));
    const distMap = new Map(distConfigs.map((d) => [d.distributorId, d.defaultLeadTimeDays]));

    for (const [productId, distributorId] of productDistributorPairs) {
      const override = overrideMap.get(productId);
      if (override != null) {
        result.set(productId, override);
        continue;
      }
      const distDefault = distMap.get(distributorId);
      result.set(productId, distDefault ?? 3);
    }
    return result;
  },

  // Aggregate net sales (units sold minus returned) per product over a window.
  // Uses grouped queries, NOT per-product queries.
  async getNetSalesStats(since: Date, statuses: string[]): Promise<NetSalesStat[]> {
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: since }, status: { in: statuses } },
      select: {
        id: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    const soldMap = new Map<string, number>();
    for (const sale of sales) {
      for (const item of sale.items) {
        soldMap.set(item.productId, (soldMap.get(item.productId) ?? 0) + item.quantity);
      }
    }

    const returns = await prisma.returnEntry.findMany({
      where: { createdAt: { gte: since } },
      select: {
        items: { select: { productId: true, quantity: true } },
      },
    });

    const returnedMap = new Map<string, number>();
    for (const r of returns) {
      for (const item of r.items) {
        returnedMap.set(item.productId, (returnedMap.get(item.productId) ?? 0) + item.quantity);
      }
    }

    const allIds = new Set([...soldMap.keys(), ...returnedMap.keys()]);
    const stats: NetSalesStat[] = [];
    for (const productId of allIds) {
      const totalSold = soldMap.get(productId) ?? 0;
      const totalReturned = returnedMap.get(productId) ?? 0;
      const net = totalSold - totalReturned;
      stats.push({ productId, totalSold, totalReturned, net: net > 0 ? net : 0 });
    }
    return stats;
  },

  async getNetSalesStatForProduct(productId: string, since: Date, statuses: string[]): Promise<{
    totalSold: number;
    totalReturned: number;
    net: number;
  }> {
    const [soldAgg, returnedAgg] = await Promise.all([
      prisma.saleItem.aggregate({
        where: { productId, sale: { createdAt: { gte: since }, status: { in: statuses } } },
        _sum: { quantity: true },
      }),
      prisma.returnItem.aggregate({
        where: { productId, returnEntry: { createdAt: { gte: since } } },
        _sum: { quantity: true },
      }),
    ]);
    const totalSold = soldAgg._sum.quantity ?? 0;
    const totalReturned = returnedAgg._sum.quantity ?? 0;
    const net = totalSold - totalReturned;
    return { totalSold, totalReturned, net: net > 0 ? net : 0 };
  },

  async getSalesHistory(productId: string, since: Date, statuses: string[]): Promise<{
    totalSold: number;
    totalReturned: number;
  }> {
    const [soldAgg, returnedAgg] = await Promise.all([
      prisma.saleItem.aggregate({
        where: { productId, sale: { createdAt: { gte: since }, status: { in: statuses } } },
        _sum: { quantity: true },
      }),
      prisma.returnItem.aggregate({
        where: { productId, returnEntry: { createdAt: { gte: since } } },
        _sum: { quantity: true },
      }),
    ]);
    return {
      totalSold: soldAgg._sum.quantity ?? 0,
      totalReturned: returnedAgg._sum.quantity ?? 0,
    };
  },

  async getPurchaseHistory(productId: string): Promise<
    { date: Date; quantity: number; purchasePrice: number; distributorId: string | null; expiry: string | null }[]
  > {
    const purchases = await prisma.stockPurchase.findMany({
      where: { productId, active: 1 },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        createdAt: true,
        quantity: true,
        purchasePrice: true,
        distributorId: true,
        expiry: true,
      },
    });
    return purchases.map((p) => ({
      date: p.createdAt,
      quantity: p.quantity,
      purchasePrice: p.purchasePrice,
      distributorId: p.distributorId,
      expiry: p.expiry,
    }));
  },

  async getTotalProductCount(): Promise<number> {
    return prisma.product.count({ where: { active: 1 } });
  },

  async countActiveProducts(): Promise<number> {
    return prisma.product.count({ where: { active: 1 } });
  },
};
