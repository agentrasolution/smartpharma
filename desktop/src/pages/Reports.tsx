import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  TrendingUp,
  DollarSign,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  Calendar,
  Percent,
  Receipt,
  Scale,
  RefreshCw,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTable from "@/components/shared/DataTable";
import StatCard from "@/components/shared/StatCard";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import type { MarginReportItem, LossItem, StockValuationCategory, StockValuationBranch } from "@/types";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const [marginGroupBy, setMarginGroupBy] = useState<"drug" | "category" | "supplier" | "branch">("drug");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Queries
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.branches.list().catch(() => []),
  });

  const { data: pnl, isLoading: pnlLoading, refetch: refetchPnl } = useQuery({
    queryKey: ["reports-pnl", dateRange.from, dateRange.to, selectedBranchId],
    queryFn: () =>
      api.reports.profitAndLoss({
        startDate: dateRange.from,
        endDate: dateRange.to,
        branchId: selectedBranchId || undefined,
      }),
  });

  const { data: marginReport, refetch: refetchMargins } = useQuery({
    queryKey: ["reports-margins", dateRange.from, dateRange.to, marginGroupBy, selectedBranchId],
    queryFn: () =>
      api.reports.margins({
        startDate: dateRange.from,
        endDate: dateRange.to,
        groupBy: marginGroupBy,
        branchId: selectedBranchId || undefined,
      }),
  });

  const { data: lossReport, refetch: refetchLosses } = useQuery({
    queryKey: ["reports-losses", dateRange.from, dateRange.to, selectedBranchId],
    queryFn: () =>
      api.reports.losses({
        startDate: dateRange.from,
        endDate: dateRange.to,
        branchId: selectedBranchId || undefined,
      }),
  });

  const { data: valuation, refetch: refetchValuation } = useQuery({
    queryKey: ["reports-valuation", selectedBranchId],
    queryFn: () => api.reports.valuation(selectedBranchId || undefined),
  });

  const handleExportCsv = async (type: "sales_cogs" | "margin" | "valuation" | "pnl") => {
    try {
      setIsExporting(true);
      const res = await api.reports.exportCsv({
        type,
        startDate: dateRange.from,
        endDate: dateRange.to,
        branchId: selectedBranchId || undefined,
        groupBy: marginGroupBy,
      });

      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to export report: " + (err.message || "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  const marginColumns = [
    {
      key: "label",
      header: marginGroupBy === "drug" ? "Product / Drug" : marginGroupBy === "category" ? "Category" : marginGroupBy === "supplier" ? "Supplier" : "Branch",
      cell: (item: MarginReportItem) => (
        <div>
          <div className="font-medium text-text-primary">{item.label}</div>
          {item.subLabel && <div className="text-xs text-text-secondary font-mono">{item.subLabel}</div>}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Units Sold",
      cell: (item: MarginReportItem) => <span className="font-mono">{item.quantity}</span>,
      className: "text-right",
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (item: MarginReportItem) => <span className="font-mono font-medium">{formatCurrency(item.revenue)}</span>,
      className: "text-right",
    },
    {
      key: "cogs",
      header: "COGS",
      cell: (item: MarginReportItem) => <span className="font-mono text-text-secondary">{formatCurrency(item.cogs)}</span>,
      className: "text-right",
    },
    {
      key: "grossProfit",
      header: "Gross Profit",
      cell: (item: MarginReportItem) => (
        <span className={`font-mono font-semibold ${item.grossProfit >= 0 ? "text-success" : "text-danger"}`}>
          {formatCurrency(item.grossProfit)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "marginPercent",
      header: "Margin %",
      cell: (item: MarginReportItem) => (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold ${
          item.marginPercent >= 30 ? "bg-emerald-500/10 text-emerald-500" :
          item.marginPercent >= 15 ? "bg-amber-500/10 text-amber-500" :
          "bg-rose-500/10 text-rose-500"
        }`}>
          {item.marginPercent}%
        </span>
      ),
      className: "text-right",
    },
  ];

  const adjustmentColumns = [
    {
      key: "productName",
      header: "Product / Batch",
      cell: (item: LossItem) => (
        <div>
          <span className="font-medium text-text-primary">{item.productName}</span>
          <div className="text-xs text-text-secondary font-mono">Batch: {item.batchNumber}</div>
        </div>
      ),
    },
    {
      key: "unitsLost",
      header: "Units Lost",
      cell: (item: LossItem) => <span className="font-mono text-danger font-medium">-{item.unitsLost}</span>,
      className: "text-right",
    },
    {
      key: "unitCost",
      header: "Unit Cost",
      cell: (item: LossItem) => <span className="font-mono">{formatCurrency(item.unitCost)}</span>,
      className: "text-right",
    },
    {
      key: "estimatedLoss",
      header: "Loss Amount",
      cell: (item: LossItem) => <span className="font-mono font-bold text-danger">{formatCurrency(item.estimatedLoss)}</span>,
      className: "text-right",
    },
    {
      key: "reason",
      header: "Reason / Note",
      cell: (item: LossItem) => <span className="text-xs text-text-secondary">{item.reason}</span>,
    },
    {
      key: "date",
      header: "Date",
      cell: (item: LossItem) => <span className="text-xs font-mono text-text-secondary">{formatDateTime(item.date)}</span>,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Costing & Reports"
        description="Real-time COGS, profit & loss statement, gross margin analytics, and stock valuation."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv("sales_cogs")}
              disabled={isExporting}
              className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2 font-medium"
            >
              <FileSpreadsheet className="h-4 w-4 text-success" />
              Export COGS Ledger
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv("pnl")}
              disabled={isExporting}
              className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2 font-medium"
            >
              <Download className="h-4 w-4 text-accent" />
              Export P&L
            </Button>
          </div>
        }
      />

      {/* Global Filter Bar */}
      <div className="p-3 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">From:</span>
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="h-9 w-36 text-xs rounded-xl border-border/80 bg-surface-2/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-secondary">To:</span>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="h-9 w-36 text-xs rounded-xl border-border/80 bg-surface-2/40"
            />
          </div>
          {branches.length > 1 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-text-secondary" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-9 rounded-xl border border-border/80 bg-surface-2/40 px-3 text-xs outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            refetchPnl();
            refetchMargins();
            refetchLosses();
            refetchValuation();
          }}
          className="h-9 rounded-xl text-xs gap-1.5 text-text-secondary hover:text-text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Executive KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Net Sales Revenue"
          value={pnl?.salesRevenue.netSales ?? 0}
          icon={<DollarSign className="h-5 w-5" />}
          color="accent"
          loading={pnlLoading}
          subtitle={`Gross: ${formatCurrency(pnl?.salesRevenue.grossSales ?? 0)}`}
        />
        <StatCard
          title="Total COGS"
          value={pnl?.costOfGoodsSold.totalCogs ?? 0}
          icon={<Scale className="h-5 w-5" />}
          color="warning"
          loading={pnlLoading}
          subtitle="Locked purchase costs"
        />
        <StatCard
          title="Gross Profit"
          value={pnl?.costOfGoodsSold.grossProfit ?? 0}
          icon={<TrendingUp className="h-5 w-5" />}
          color="success"
          loading={pnlLoading}
          subtitle={`Gross Margin: ${pnl?.costOfGoodsSold.grossMarginPercent ?? 0}%`}
        />
        <StatCard
          title="Operating Profit"
          value={pnl?.netProfit.netOperatingProfit ?? 0}
          icon={<Percent className="h-5 w-5" />}
          color={(pnl?.netProfit.netOperatingProfit ?? 0) >= 0 ? "accent" : "danger"}
          loading={pnlLoading}
          subtitle={`EBITDA: ${pnl?.netProfit.netProfitMarginPercent ?? 0}%`}
        />
        <StatCard
          title="Net VAT Position"
          value={pnl?.taxAndVat.netVatPayable ?? 0}
          icon={<Receipt className="h-5 w-5" />}
          color="purple"
          loading={pnlLoading}
          subtitle={`Collected: ${formatCurrency(pnl?.taxAndVat.vatCollectedOnSales ?? 0)}`}
        />
      </div>

      {/* Main Reporting Tabs */}
      <Tabs defaultValue="pnl" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full bg-muted/60 p-1">
          <TabsTrigger value="pnl" className="text-xs">
            Profit & Loss (P&L)
          </TabsTrigger>
          <TabsTrigger value="margins" className="text-xs">
            Gross Margin Breakdown
          </TabsTrigger>
          <TabsTrigger value="losses" className="text-xs">
            Shrinkage & Losses
          </TabsTrigger>
          <TabsTrigger value="valuation" className="text-xs">
            Stock Valuation
          </TabsTrigger>
          <TabsTrigger value="cogs_ledger" className="text-xs">
            Sales COGS Ledger
          </TabsTrigger>
        </TabsList>

        {/* 1. PROFIT & LOSS STATEMENT (P&L) */}
        <TabsContent value="pnl" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Profit and Loss Statement</h3>
              <p className="text-xs text-text-secondary">
                Period: {pnl?.period.startDate || dateRange.from} to {pnl?.period.endDate || dateRange.to}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv("pnl")}
              className="flex items-center gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download P&L CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sales & Gross Margin Table */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Trading Revenue & Cost of Goods
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between py-1.5 border-b border-border/50 text-sm">
                  <span className="text-text-secondary">Gross Sales ({pnl?.salesRevenue.salesCount ?? 0} invoices)</span>
                  <span className="font-mono font-medium">{formatCurrency(pnl?.salesRevenue.grossSales ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50 text-sm">
                  <span className="text-text-secondary">Discounts Allowed</span>
                  <span className="font-mono text-danger font-medium">-{formatCurrency(pnl?.salesRevenue.discounts ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50 text-sm">
                  <span className="text-text-secondary">Output VAT Collected</span>
                  <span className="font-mono text-purple-400 font-medium">-{formatCurrency(pnl?.salesRevenue.vatCollected ?? 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border text-sm font-semibold">
                  <span className="text-text-primary">Net Sales Revenue</span>
                  <span className="font-mono text-primary">{formatCurrency(pnl?.salesRevenue.netSales ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50 text-sm">
                  <span className="text-text-secondary">Cost of Goods Sold (COGS)</span>
                  <span className="font-mono text-amber-500 font-medium">-{formatCurrency(pnl?.costOfGoodsSold.totalCogs ?? 0)}</span>
                </div>
                <div className="flex justify-between py-2.5 bg-emerald-500/10 px-3 rounded-lg text-sm font-bold text-emerald-600">
                  <span>Gross Profit</span>
                  <span className="font-mono">{formatCurrency(pnl?.costOfGoodsSold.grossProfit ?? 0)} ({pnl?.costOfGoodsSold.grossMarginPercent ?? 0}%)</span>
                </div>
              </CardContent>
            </Card>

            {/* Operating Expenses & Net Income */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  Operating Expenses & Net Position
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {pnl?.operatingExpenses.byCategory.length === 0 ? (
                    <div className="text-xs text-text-secondary italic py-2">No operating expenses logged in this period.</div>
                  ) : (
                    pnl?.operatingExpenses.byCategory.map((cat: { category: string; amount: number }, idx: number) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-border/40 text-xs">
                        <span className="text-text-secondary">{cat.category}</span>
                        <span className="font-mono font-medium">{formatCurrency(cat.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex justify-between py-1.5 border-b border-border text-sm font-semibold">
                  <span className="text-text-secondary">Total Operating Expenses</span>
                  <span className="font-mono text-danger font-medium">-{formatCurrency(pnl?.operatingExpenses.total ?? 0)}</span>
                </div>
                <div className="flex justify-between py-2.5 bg-blue-500/10 px-3 rounded-lg text-sm font-bold text-blue-600">
                  <span>Net Operating Profit (EBITDA)</span>
                  <span className="font-mono">
                    {formatCurrency(pnl?.netProfit.netOperatingProfit ?? 0)} ({pnl?.netProfit.netProfitMarginPercent ?? 0}%)
                  </span>
                </div>

                <div className="pt-2 border-t border-border space-y-1">
                  <div className="text-xs font-semibold text-text-secondary">VAT Statement</div>
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>VAT Collected on Sales:</span>
                    <span className="font-mono">{formatCurrency(pnl?.taxAndVat.vatCollectedOnSales ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>Input VAT Paid on Purchases:</span>
                    <span className="font-mono">{formatCurrency(pnl?.taxAndVat.vatPaidOnPurchases ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-purple-400 pt-1">
                    <span>Net VAT Payable / (Claimable):</span>
                    <span className="font-mono">{formatCurrency(pnl?.taxAndVat.netVatPayable ?? 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. GROSS MARGIN BREAKDOWN */}
        <TabsContent value="margins" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">Group Margin By:</span>
              <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
                {(["drug", "category", "supplier", "branch"] as const).map((group) => (
                  <button
                    key={group}
                    onClick={() => setMarginGroupBy(group)}
                    className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                      marginGroupBy === group
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv("margin")}
              className="flex items-center gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download Margin CSV
            </Button>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold capitalize">
                  Profitability Breakdown ({marginGroupBy})
                </CardTitle>
                <CardDescription className="text-xs">
                  Showing {marginReport?.items.length ?? 0} entries. Overall Margin: {marginReport?.overallMarginPercent ?? 0}%
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold font-mono text-emerald-500">
                  Total Profit: {formatCurrency(marginReport?.totalGrossProfit ?? 0)}
                </div>
                <div className="text-xs text-text-secondary font-mono">
                  Rev: {formatCurrency(marginReport?.totalRevenue ?? 0)} | COGS: {formatCurrency(marginReport?.totalCogs ?? 0)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={marginColumns}
                data={marginReport?.items ?? []}
                keyExtractor={(item: MarginReportItem) => item.key}
                emptyMessage="No sales recorded for this period."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. LOSS REPORTS & INVENTORY SHRINKAGE */}
        <TabsContent value="losses" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-secondary uppercase">
                  Total Quantified Loss
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-danger">
                  {formatCurrency(lossReport?.summary.totalLoss ?? 0)}
                </div>
                <p className="text-xs text-text-secondary mt-1">Shrinkage + Expiries + Refunds</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-secondary uppercase">
                  Inventory Shrinkage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-amber-500">
                  {formatCurrency(lossReport?.summary.adjustmentLoss ?? 0)}
                </div>
                <p className="text-xs text-text-secondary mt-1">Negative stock adjustments</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-secondary uppercase">
                  Expiry Discards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-rose-500">
                  {formatCurrency(lossReport?.summary.expiryLoss ?? 0)}
                </div>
                <p className="text-xs text-text-secondary mt-1">Expired / recalled medicines</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-secondary uppercase">
                  Customer Refunds
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {formatCurrency(lossReport?.summary.customerRefunds ?? 0)}
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {lossReport?.returnsCount ?? 0} returned transactions
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-danger">
                <AlertTriangle className="h-4 w-4" />
                Negative Inventory Adjustments & Damaged Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={adjustmentColumns}
                data={lossReport?.adjustmentLosses ?? []}
                keyExtractor={(item: LossItem) => item.id}
                emptyMessage="No inventory shrinkage records in this date range."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. REAL-TIME STOCK VALUATION */}
        <TabsContent value="valuation" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Stock Valuation (Cost vs Retail)</h3>
              <p className="text-xs text-text-secondary">
                Valued across {valuation?.summary.totalActiveBatches ?? 0} active batches ({valuation?.summary.totalUnits ?? 0} units)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv("valuation")}
              className="flex items-center gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download Valuation CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-secondary uppercase">
                  Valuation at Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-amber-500">
                  {formatCurrency(valuation?.summary.totalCostValuation ?? 0)}
                </div>
                <p className="text-xs text-text-secondary mt-1">Asset cost on shelf</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-secondary uppercase">
                  Valuation at Retail
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(valuation?.summary.totalRetailValuation ?? 0)}
                </div>
                <p className="text-xs text-text-secondary mt-1">Public selling price value</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-secondary uppercase">
                  Potential Gross Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-500">
                  {formatCurrency(valuation?.summary.potentialGrossProfit ?? 0)}
                </div>
                <p className="text-xs text-text-secondary mt-1">Expected upon full sale</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-secondary uppercase">
                  Potential Margin %
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-500">
                  {valuation?.summary.potentialMarginPercent ?? 0}%
                </div>
                <p className="text-xs text-text-secondary mt-1">Overall shelf markup</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Category */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Valuation by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-text-secondary uppercase border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Category</th>
                        <th className="py-2.5 px-3 text-right">Units</th>
                        <th className="py-2.5 px-3 text-right">Cost Value</th>
                        <th className="py-2.5 px-3 text-right">Retail Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {valuation?.byCategory.map((cat: StockValuationCategory, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium text-text-primary">{cat.category}</td>
                          <td className="py-2 px-3 text-right font-mono">{cat.units}</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-500">{formatCurrency(cat.costValue)}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium">{formatCurrency(cat.retailValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* By Branch */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  Valuation by Branch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-text-secondary uppercase border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Branch</th>
                        <th className="py-2.5 px-3 text-right">Units</th>
                        <th className="py-2.5 px-3 text-right">Cost Value</th>
                        <th className="py-2.5 px-3 text-right">Retail Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {valuation?.byBranch.map((br: StockValuationBranch, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium text-text-primary">{br.branchName}</td>
                          <td className="py-2 px-3 text-right font-mono">{br.units}</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-500">{formatCurrency(br.costValue)}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium">{formatCurrency(br.retailValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 5. SALES COGS LEDGER */}
        <TabsContent value="cogs_ledger" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 gap-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  Accountant COGS & Tax Ledger
                </CardTitle>
                <CardDescription className="text-xs">
                  Full transaction audit log pairing every dispensed unit with its exact acquisition batch cost and VAT rate.
                </CardDescription>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleExportCsv("sales_cogs")}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                Download Full Ledger (CSV)
              </Button>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-muted/30 border border-border text-xs space-y-2">
                <div className="font-semibold text-text-primary flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-primary" />
                  Accountant Export Specifications:
                </div>
                <ul className="list-disc pl-5 space-y-1 text-text-secondary">
                  <li>Includes Sale ID, Timestamp, Branch Name, Payment Method (Cash/Card/Credit).</li>
                  <li>Item details: Drug Name, Barcode, Batch Number, Dispensed Quantity.</li>
                  <li>Cost accounting: Exact Unit Acquisition Cost, Selling Unit Price, Line Revenue, Line COGS, and Gross Profit.</li>
                  <li>Tax accounting: Configured Category VAT % (0% to Standard) and Calculated Line VAT Amount.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
