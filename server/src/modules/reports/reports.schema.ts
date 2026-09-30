import { z } from "zod";

export const reportDateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.string().optional(),
});

export const marginReportQuerySchema = reportDateRangeSchema.extend({
  groupBy: z.enum(["drug", "category", "supplier", "branch"]).optional().default("drug"),
});

export const exportReportQuerySchema = reportDateRangeSchema.extend({
  type: z.enum(["sales_cogs", "pnl", "valuation", "loss", "margin"]),
  groupBy: z.enum(["drug", "category", "supplier", "branch"]).optional().default("drug"),
  format: z.enum(["csv", "json"]).optional().default("json"),
});

export type ReportDateRangeQuery = z.infer<typeof reportDateRangeSchema>;
export type MarginReportQuery = z.infer<typeof marginReportQuerySchema>;
export type ExportReportQuery = z.infer<typeof exportReportQuerySchema>;
