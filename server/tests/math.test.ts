import { describe, expect, it } from "vitest";
import {
  analyzeProduct,
  getAverageDailySales,
  getLeadTimeDemand,
  getNetSales,
  getPackRoundedQuantity,
  getRecommendedQuantity,
  getReorderPoint,
  getRiskLevel,
  getSafetyStock,
  getStockCoverage,
  getStockoutEstimate,
  getTargetStock,
  round2,
} from "../src/inventory/math";

// Spec #88: the deterministic engine must return exact fixture values.
describe("inventory math fixtures (spec #88)", () => {
  const stock = 15;
  const dailySales = 12; // average daily sales
  const leadTimeDays = 3;
  const safetyStockDays = 2;
  const targetStockDays = 14;
  const analysisDays = 30;

  it("stockout estimate = 1.25 (15 / 12)", () => {
    expect(getStockoutEstimate(stock, dailySales)).toBe(1.25);
  });

  it("lead time demand = 36 (12 * 3)", () => {
    expect(getLeadTimeDemand(dailySales, leadTimeDays)).toBe(36);
  });

  it("safety stock = 24 (12 * 2)", () => {
    expect(getSafetyStock(dailySales, safetyStockDays)).toBe(24);
  });

  it("reorder point = 60 (36 + 24)", () => {
    expect(getReorderPoint(36, 24)).toBe(60);
  });

  it("target stock = 168 (12 * 14)", () => {
    expect(getTargetStock(dailySales, targetStockDays)).toBe(168);
  });

  it("recommended quantity = 153 (168 - 15 - 0)", () => {
    expect(getRecommendedQuantity(168, 15, 0)).toBe(153);
  });

  it("analyzeProduct returns exact fixture object", () => {
    const result = analyzeProduct({
      stock,
      netSold: dailySales * analysisDays, // 360
      analysisDays,
      leadTimeDays,
      safetyStockDays,
      targetStockDays,
      lowStockThreshold: 10,
      overstockCoverageDays: 90,
      incomingStock: 0,
      packSize: 1,
    });
    expect(result.averageDailySales).toBe(12);
    expect(result.stockCoverageDays).toBe(1.25);
    expect(result.estimatedStockoutDays).toBe(1.25);
    expect(result.leadTimeDemand).toBe(36);
    expect(result.safetyStock).toBe(24);
    expect(result.reorderPoint).toBe(60);
    expect(result.targetStock).toBe(168);
    expect(result.recommendedQuantity).toBe(153);
    // stockout (1.25) < leadTime (3) -> CRITICAL
    expect(result.riskLevel).toBe("CRITICAL");
  });
});

// Spec #89: pack-size rounding must round quantities up to the next whole pack.
describe("pack rounding (spec #89)", () => {
  it("rounds 153 up to 160 with packSize 10", () => {
    expect(getPackRoundedQuantity(153, 10)).toBe(160);
  });

  it("rounds 155 up to 160 with packSize 20 strips to 160", () => {
    expect(getPackRoundedQuantity(155, 20)).toBe(160);
  });

  it("a quantity that is already a multiple of the pack is unchanged", () => {
    expect(getPackRoundedQuantity(100, 10)).toBe(100);
  });

  it("zero or negative quantity stays 0", () => {
    expect(getPackRoundedQuantity(0, 10)).toBe(0);
    expect(getPackRoundedQuantity(-4, 10)).toBe(0);
  });

  it("invalid pack size falls back to unit (pack 1)", () => {
    expect(getPackRoundedQuantity(153, 0)).toBe(153);
    expect(getPackRoundedQuantity(153, -5)).toBe(153);
  });
});

// Spec #90: net sales must subtract returns.
describe("net sales accounting (spec #90)", () => {
  it("net = sold - returned", () => {
    expect(getNetSales(100, 20)).toBe(80);
  });

  it("never negative", () => {
    expect(getNetSales(20, 100)).toBe(0);
  });
});

// Spec #91: zero sales must not produce division by zero.
describe("zero-sales safety (spec #91)", () => {
  it("coverage and stockout are null when average daily sales is 0", () => {
    expect(getStockCoverage(15, 0)).toBeNull();
    expect(getStockoutEstimate(15, 0)).toBeNull();
  });

  it("average daily sales is 0 not NaN for zero net sold", () => {
    expect(getAverageDailySales(0, 30)).toBe(0);
    expect(getAverageDailySales(0, 30)).not.toBeNaN();
  });

  it("analyzeProduct with zero sales never returns NaN", () => {
    const r = analyzeProduct({
      stock: 15,
      netSold: 0,
      analysisDays: 30,
      leadTimeDays: 3,
      safetyStockDays: 2,
      targetStockDays: 14,
      lowStockThreshold: 10,
      overstockCoverageDays: 90,
      incomingStock: 0,
      packSize: 10,
    });
    for (const k of [
      "averageDailySales",
      "stockCoverageDays",
      "estimatedStockoutDays",
      "leadTimeDemand",
      "safetyStock",
      "reorderPoint",
      "targetStock",
      "recommendedQuantity",
      "recommendedQuantityPacked",
    ] as const) {
      const v = r[k];
      if (typeof v === "number") expect(Number.isNaN(v)).toBe(false);
      else expect(typeof v).toBe("object");
    }
  });

  it("zero-sales product with plenty of stock is HEALTHY, not CRITICAL", () => {
    const r = analyzeProduct({
      stock: 100,
      netSold: 0,
      analysisDays: 30,
      leadTimeDays: 3,
      safetyStockDays: 2,
      targetStockDays: 14,
      lowStockThreshold: 10,
      overstockCoverageDays: 90,
      incomingStock: 0,
      packSize: 10,
    });
    expect(r.riskLevel).toBe("HEALTHY");
  });

  it("round2 is stable on positive fractions", () => {
    expect(round2(12.345)).toBe(12.35);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("risk level precedence", () => {
  it("overstock never masks an imminent stockout", () => {
    const level = getRiskLevel({
      currentStock: 3,
      averageDailySales: 6,
      leadTimeDays: 3,
      stockoutDays: 0.5,
      reorderPoint: 12,
      lowStockThreshold: 10,
      stockCoverageDays: 120,
      overstockCoverageDays: 90,
    });
    expect(level).toBe("CRITICAL");
  });

  it("at/below reorder point is HIGH", () => {
    const level = getRiskLevel({
      currentStock: 10,
      averageDailySales: 2,
      leadTimeDays: 3,
      stockoutDays: 5,
      reorderPoint: 10,
      lowStockThreshold: 10,
      stockCoverageDays: 5,
      overstockCoverageDays: 90,
    });
    expect(level).toBe("HIGH");
  });

  it("excessive coverage is OVERSTOCK", () => {
    const level = getRiskLevel({
      currentStock: 300,
      averageDailySales: 2,
      leadTimeDays: 3,
      stockoutDays: 150,
      reorderPoint: 10,
      lowStockThreshold: 10,
      stockCoverageDays: 150,
      overstockCoverageDays: 90,
    });
    expect(level).toBe("OVERSTOCK");
  });
});