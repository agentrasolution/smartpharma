// Pure deterministic inventory math. No I/O, no database.
// This module is the single source of truth for all inventory calculations
// and must remain independently unit-testable.

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "HEALTHY" | "OVERSTOCK";

export interface AnalysisOptions {
  stock: number;
  netSold: number;
  analysisDays: number;
  leadTimeDays: number;
  safetyStockDays: number;
  targetStockDays: number;
  lowStockThreshold: number;
  overstockCoverageDays: number;
  incomingStock: number;
  packSize: number;
}

export interface AnalysisResult {
  currentStock: number;
  netSold: number;
  averageDailySales: number;
  stockCoverageDays: number | null;
  estimatedStockoutDays: number | null;
  leadTimeDemand: number;
  safetyStock: number;
  reorderPoint: number;
  targetStock: number;
  recommendedQuantity: number;
  recommendedQuantityPacked: number;
  riskLevel: RiskLevel;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function getNetSales(totalSold: number, totalReturned: number): number {
  const net = totalSold - totalReturned;
  return net > 0 ? net : 0;
}

export function getAverageDailySales(netSold: number, analysisDays: number): number {
  if (analysisDays <= 0) return 0;
  const avg = netSold / analysisDays;
  return round2(avg);
}

export function getStockCoverage(currentStock: number, averageDailySales: number): number | null {
  if (averageDailySales <= 0) return null;
  return round2(currentStock / averageDailySales);
}

export function getStockoutEstimate(currentStock: number, averageDailySales: number): number | null {
  if (averageDailySales <= 0) return null;
  return round2(currentStock / averageDailySales);
}

export function getLeadTimeDemand(averageDailySales: number, leadTimeDays: number): number {
  if (leadTimeDays <= 0) return 0;
  return round2(averageDailySales * leadTimeDays);
}

export function getSafetyStock(averageDailySales: number, safetyStockDays: number): number {
  if (safetyStockDays <= 0) return 0;
  return round2(averageDailySales * safetyStockDays);
}

export function getReorderPoint(leadTimeDemand: number, safetyStock: number): number {
  return round2(leadTimeDemand + safetyStock);
}

export function getTargetStock(averageDailySales: number, targetStockDays: number): number {
  if (targetStockDays <= 0) return 0;
  return round2(averageDailySales * targetStockDays);
}

export function getRecommendedQuantity(
  targetStock: number,
  currentStock: number,
  incomingStock: number,
): number {
  const qty = Math.ceil(targetStock - currentStock - incomingStock);
  return qty > 0 ? qty : 0;
}

export function getPackRoundedQuantity(recommendedQuantity: number, packSize: number): number {
  const pack = packSize > 0 ? Math.floor(packSize) : 1;
  if (recommendedQuantity <= 0) return 0;
  return Math.ceil(recommendedQuantity / pack) * pack;
}

export function getRiskLevel(params: {
  currentStock: number;
  averageDailySales: number;
  leadTimeDays: number;
  stockoutDays: number | null;
  reorderPoint: number;
  lowStockThreshold: number;
  stockCoverageDays: number | null;
  overstockCoverageDays: number;
}): RiskLevel {
  const {
    stockoutDays,
    leadTimeDays,
    currentStock,
    reorderPoint,
    averageDailySales,
    lowStockThreshold,
    stockCoverageDays,
    overstockCoverageDays,
  } = params;

  // CRITICAL: about to run out before restock arrives. Evaluated first so
  // overstock / low-sales conditions never override a real shortage.
  if (stockoutDays !== null && averageDailySales > 0 && stockoutDays < leadTimeDays) {
    return "CRITICAL";
  }

  // HIGH: at or below reorder point.
  if (currentStock <= reorderPoint) {
    return "HIGH";
  }

  // OVERSTOCK: excessive coverage. Applied after the shortage checks above.
  if (stockCoverageDays !== null && averageDailySales > 0 && stockCoverageDays > overstockCoverageDays) {
    return "OVERSTOCK";
  }

  // MEDIUM: at or below a simple low-stock threshold (used when no sales data).
  if (averageDailySales > 0 && currentStock <= lowStockThreshold) {
    return "MEDIUM";
  }

  if (averageDailySales <= 0 && currentStock <= lowStockThreshold) {
    return "MEDIUM";
  }

  return "HEALTHY";
}

export function analyzeProduct(options: AnalysisOptions): AnalysisResult {
  const {
    stock,
    netSold,
    analysisDays,
    leadTimeDays,
    safetyStockDays,
    targetStockDays,
    lowStockThreshold,
    overstockCoverageDays,
    incomingStock,
    packSize,
  } = options;

  const currentStock = stock;
  const averageDailySales = getAverageDailySales(netSold, analysisDays);
  const stockCoverageDays = getStockCoverage(currentStock, averageDailySales);
  const estimatedStockoutDays = getStockoutEstimate(currentStock, averageDailySales);
  const leadTimeDemand = getLeadTimeDemand(averageDailySales, leadTimeDays);
  const safetyStock = getSafetyStock(averageDailySales, safetyStockDays);
  const reorderPoint = getReorderPoint(leadTimeDemand, safetyStock);
  const targetStock = getTargetStock(averageDailySales, targetStockDays);
  const recommendedQuantity = getRecommendedQuantity(targetStock, currentStock, incomingStock);
  const recommendedQuantityPacked = getPackRoundedQuantity(recommendedQuantity, packSize);
  const riskLevel = getRiskLevel({
    currentStock,
    averageDailySales,
    leadTimeDays,
    stockoutDays: estimatedStockoutDays,
    reorderPoint,
    lowStockThreshold,
    stockCoverageDays,
    overstockCoverageDays,
  });

  return {
    currentStock,
    netSold,
    averageDailySales,
    stockCoverageDays,
    estimatedStockoutDays,
    leadTimeDemand,
    safetyStock,
    reorderPoint,
    targetStock,
    recommendedQuantity,
    recommendedQuantityPacked,
    riskLevel,
  };
}
