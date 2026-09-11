import { prisma } from "../../services/prisma";
import type { Prisma } from "../../generated/prisma/client";

export const reportsService = {
  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [todayRevenue, totalArrears, lowStockCount, expiringSoonCount, weekRevenue, monthRevenue, topProducts] =
      await Promise.all([
        prisma.sale.aggregate({
          where: { createdAt: { gte: today } },
          _sum: { total: true },
        }),

        prisma.arrear.aggregate({
          where: { status: "pending" },
          _sum: { balanceDue: true },
        }),

        prisma.product.count({
          where: { stockQty: { lte: 5 } },
        }),

        prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT COUNT(*) as count FROM products WHERE expiry IS NOT NULL AND expiry::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`,
        ).then((r) => Number(r[0]?.count ?? 0)),

        prisma.sale.groupBy({
          by: ["createdAt"],
          where: { createdAt: { gte: sevenDaysAgo } },
          _sum: { total: true },
          orderBy: { createdAt: "asc" },
        }),

        prisma.sale.groupBy({
          by: ["createdAt"],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _sum: { total: true },
          orderBy: { createdAt: "asc" },
        }),

        prisma.saleItem.groupBy({
          by: ["productName"],
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        }),
      ]);

    return {
      todayRevenue: todayRevenue._sum.total ?? 0,
      totalArrears: totalArrears._sum.balanceDue ?? 0,
      lowStockCount,
      expiringSoonCount,
      weekRevenue: weekRevenue.map((r: Record<string, unknown>) => ({
        day: (r.createdAt as Date).toISOString().split("T")[0]!,
        revenue: (r._sum as Record<string, number>).total ?? 0,
      })),
      monthRevenue: monthRevenue.map((r: Record<string, unknown>) => ({
        day: (r.createdAt as Date).toISOString().split("T")[0]!,
        revenue: (r._sum as Record<string, number>).total ?? 0,
      })),
      topProducts: topProducts.map((p: Record<string, unknown>) => ({
        name: p.productName as string,
        value: (p._sum as Record<string, number>).quantity ?? 0,
      })),
    };
  },
};
