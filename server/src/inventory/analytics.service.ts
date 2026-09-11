import { analyzeProduct, type AnalysisResult, type RiskLevel } from "./math";

// Wraps analyzeProduct to provide per-product inventory analysis using loaded
// config + aggregated sales data. Deterministic and unit-testable.
export class InventoryAnalysisService {
  constructor(
    private readonly config: {
      defaultSafetyStockDays: number;
      defaultTargetStockDays: number;
      lowStockThreshold: number;
      overstockCoverageDays: number;
    },
  ) {}

  analyzeSingle(params: {
    currentStock: number;
    netSold: number;
    analysisDays: number;
    leadTimeDays: number;
    incomingStock?: number;
    packSize?: number;
  }): AnalysisResult {
    return analyzeProduct({
      stock: params.currentStock,
      netSold: params.netSold,
      analysisDays: params.analysisDays,
      leadTimeDays: params.leadTimeDays,
      safetyStockDays: this.config.defaultSafetyStockDays,
      targetStockDays: this.config.defaultTargetStockDays,
      lowStockThreshold: this.config.lowStockThreshold,
      overstockCoverageDays: this.config.overstockCoverageDays,
      incomingStock: params.incomingStock ?? 0,
      packSize: params.packSize ?? 1,
    });
  }
}

export { analyzeProduct, type AnalysisResult, type RiskLevel };
