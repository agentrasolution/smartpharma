import { round2 } from "./math";

export type TrendDirection = "INCREASING" | "STABLE" | "DECREASING";

export interface TrendResult {
  direction: TrendDirection;
  recentNetSold: number;
  previousNetSold: number;
  changePercent: number | null;
}

export function classifyTrend(
  recentNetSold: number,
  previousNetSold: number,
  thresholdPercent: number,
): TrendResult {
  if (previousNetSold <= 0 && recentNetSold <= 0) {
    return { direction: "STABLE", recentNetSold, previousNetSold, changePercent: null };
  }
  if (previousNetSold <= 0) {
    return { direction: "INCREASING", recentNetSold, previousNetSold, changePercent: null };
  }
  const changePercent = round2(((recentNetSold - previousNetSold) / previousNetSold) * 100);
  if (changePercent > thresholdPercent) {
    return { direction: "INCREASING", recentNetSold, previousNetSold, changePercent };
  }
  if (changePercent < -thresholdPercent) {
    return { direction: "DECREASING", recentNetSold, previousNetSold, changePercent };
  }
  return { direction: "STABLE", recentNetSold, previousNetSold, changePercent };
}
