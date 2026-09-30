"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PortalNav } from "@/components/portal-nav";
import { api } from "@/lib/api";
import {
  TrendingUp,
  DollarSign,
  Download,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  Percent,
  Receipt,
  Scale,
  RefreshCw,
  Search,
} from "lucide-react";
import type {
  ProfitAndLoss,
  MarginReport,
  MarginReportItem,
  LossReport,
  LossItem,
  StockValuation,
  StockValuationCategory,
  StockValuationBranch,
  Branch,
} from "@/types";

function getDefaultDateRange() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  return {
    from: thirtyDaysAgo.toISOString().split("T")[0]!,
    to: now.toISOString().split("T")[0]!,
  };
}

export default function ReportsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  const [activeTab, setActiveTab] = useState<"pnl" | "margins" | "losses" | "valuation" | "cogs_ledger">("pnl");
  const [marginGroupBy, setMarginGroupBy] = useState<"drug" | "category" | "supplier" | "branch">("drug");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [marginSearch, setMarginSearch] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [pnl, setPnl] = useState<ProfitAndLoss | null>(null);
  const [marginReport, setMarginReport] = useState<MarginReport | null>(null);
  const [lossReport, setLossReport] = useState<LossReport | null>(null);
  const [valuation, setValuation] = useState<StockValuation | null>(null);

  useEffect(() => {
    if (!isAuthenticated && typeof window !== "undefined" && !localStorage.getItem("faraz_access_token")) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [branchList, pnlData, marginData, lossData, valData] = await Promise.all([
        api.branches.list().catch(() => []),
        api.reports.profitAndLoss({
          startDate: dateRange.from,
          endDate: dateRange.to,
          branchId: selectedBranchId || undefined,
        }).catch(() => null),
        api.reports.margins({
          startDate: dateRange.from,
          endDate: dateRange.to,
          groupBy: marginGroupBy,
          branchId: selectedBranchId || undefined,
        }).catch(() => null),
        api.reports.losses({
          startDate: dateRange.from,
          endDate: dateRange.to,
          branchId: selectedBranchId || undefined,
        }).catch(() => null),
        api.reports.valuation(selectedBranchId || undefined).catch(() => null),
      ]);

      setBranches(branchList);
      setPnl(pnlData);
      setMarginReport(marginData);
      setLossReport(lossData);
      setValuation(valData);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.from, dateRange.to, selectedBranchId, marginGroupBy]);

  useEffect(() => {
    if (user) {
      const t = setTimeout(() => {
        void loadData();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [user, loadData]);

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert("Failed to export report: " + msg);
    } finally {
      setIsExporting(false);
    }
  };

  if (!user && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
    }).format(amt);
  };

  const filteredMarginItems = (marginReport?.items ?? []).filter((item) => {
    if (!marginSearch.trim()) return true;
    const term = marginSearch.toLowerCase();
    return (
      item.label.toLowerCase().includes(term) ||
      (item.subLabel && item.subLabel.toLowerCase().includes(term))
    );
  });

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <PortalNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Costing & Financial Reports</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider">
                Pillar I
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Real-time batch COGS calculation, profitability analytics, inventory shrinkage, stock valuation, and accountant exports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExportCsv("sales_cogs")}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              Export COGS Ledger
            </button>
            <button
              onClick={() => handleExportCsv("pnl")}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold shadow-xs hover:bg-accent-hover transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export P&L
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-text-secondary" />
              <span className="text-xs font-medium text-text-secondary">From:</span>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-text-primary focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">To:</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-text-primary focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
            {branches.length > 1 && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-text-secondary" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-text-primary focus:ring-1 focus:ring-accent outline-none"
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

          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 text-xs font-medium text-text-secondary transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Net Sales Revenue
              </span>
              <DollarSign className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold font-mono text-text-primary">
              {isLoading ? "—" : formatCurrency(pnl?.salesRevenue.netSales ?? 0)}
            </div>
            <div className="text-[11px] text-text-secondary">
              Gross: {formatCurrency(pnl?.salesRevenue.grossSales ?? 0)}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Total COGS
              </span>
              <Scale className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-500">
              {isLoading ? "—" : formatCurrency(pnl?.costOfGoodsSold.totalCogs ?? 0)}
            </div>
            <div className="text-[11px] text-text-secondary">Locked-in batch costs</div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Gross Profit ($)
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-500">
              {isLoading ? "—" : formatCurrency(pnl?.costOfGoodsSold.grossProfit ?? 0)}
            </div>
            <div className="text-[11px] font-bold text-emerald-600">
              Margin: {pnl?.costOfGoodsSold.grossMarginPercent ?? 0}%
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Operating Income
              </span>
              <Percent className="h-4 w-4 text-blue-500" />
            </div>
            <div className={`text-2xl font-bold font-mono ${
              (pnl?.netProfit.netOperatingProfit ?? 0) >= 0 ? "text-blue-500" : "text-rose-500"
            }`}>
              {isLoading ? "—" : formatCurrency(pnl?.netProfit.netOperatingProfit ?? 0)}
            </div>
            <div className="text-[11px] text-text-secondary">
              EBITDA ({pnl?.netProfit.netProfitMarginPercent ?? 0}%)
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Net VAT Position
              </span>
              <Receipt className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-400">
              {isLoading ? "—" : formatCurrency(pnl?.taxAndVat.netVatPayable ?? 0)}
            </div>
            <div className="text-[11px] text-text-secondary">
              Collected: {formatCurrency(pnl?.taxAndVat.vatCollectedOnSales ?? 0)}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border gap-2 overflow-x-auto">
          {[
            { id: "pnl", label: "Profit & Loss (P&L)" },
            { id: "margins", label: "Gross Margin Breakdown" },
            { id: "losses", label: "Shrinkage & Losses" },
            { id: "valuation", label: "Stock Valuation" },
            { id: "cogs_ledger", label: "Sales COGS Ledger" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "border-accent text-accent font-bold"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. PROFIT AND LOSS STATEMENT */}
        {activeTab === "pnl" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sales Revenue & COGS Card */}
              <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Trading Revenue & Cost of Goods
                  </h3>
                  <span className="text-xs text-text-secondary">
                    {pnl?.salesRevenue.salesCount ?? 0} sales transactions
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-secondary">Gross Sales</span>
                    <span className="font-mono font-medium">{formatCurrency(pnl?.salesRevenue.grossSales ?? 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-secondary">Discounts Allowed</span>
                    <span className="font-mono text-danger font-medium">-{formatCurrency(pnl?.salesRevenue.discounts ?? 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-secondary">Output VAT Collected</span>
                    <span className="font-mono text-purple-400 font-medium">-{formatCurrency(pnl?.salesRevenue.vatCollected ?? 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border font-bold text-sm">
                    <span className="text-text-primary">Net Sales Revenue</span>
                    <span className="font-mono text-accent">{formatCurrency(pnl?.salesRevenue.netSales ?? 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-secondary">Cost of Goods Sold (COGS)</span>
                    <span className="font-mono text-amber-500 font-medium">-{formatCurrency(pnl?.costOfGoodsSold.totalCogs ?? 0)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 bg-emerald-500/10 px-3 rounded-xl text-sm font-bold text-emerald-600">
                    <span>Gross Trading Profit</span>
                    <span className="font-mono">
                      {formatCurrency(pnl?.costOfGoodsSold.grossProfit ?? 0)} ({pnl?.costOfGoodsSold.grossMarginPercent ?? 0}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Operating Expenses & Net Operating Profit */}
              <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    Operating Expenses & Net Position
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {pnl?.operatingExpenses.byCategory.length === 0 ? (
                      <div className="text-xs text-text-secondary italic py-2">No operating expenses recorded in this period.</div>
                    ) : (
                      pnl?.operatingExpenses.byCategory.map((cat, idx) => (
                        <div key={idx} className="flex justify-between py-1 border-b border-border/30 text-xs">
                          <span className="text-text-secondary">{cat.category}</span>
                          <span className="font-mono font-medium">{formatCurrency(cat.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-border font-semibold text-xs">
                    <span className="text-text-secondary">Total Operating Expenses</span>
                    <span className="font-mono text-danger font-medium">-{formatCurrency(pnl?.operatingExpenses.total ?? 0)}</span>
                  </div>

                  <div className="flex justify-between py-2.5 bg-blue-500/10 px-3 rounded-xl text-sm font-bold text-blue-600">
                    <span>Net Operating Profit (EBITDA)</span>
                    <span className="font-mono">
                      {formatCurrency(pnl?.netProfit.netOperatingProfit ?? 0)} ({pnl?.netProfit.netProfitMarginPercent ?? 0}%)
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border space-y-1 text-xs text-text-secondary">
                    <div className="font-semibold text-text-primary mb-1">VAT Balance Position</div>
                    <div className="flex justify-between">
                      <span>VAT Collected on Sales:</span>
                      <span className="font-mono">{formatCurrency(pnl?.taxAndVat.vatCollectedOnSales ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Input VAT Paid on Purchases:</span>
                      <span className="font-mono">{formatCurrency(pnl?.taxAndVat.vatPaidOnPurchases ?? 0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-purple-400 pt-1 border-t border-border/40">
                      <span>Net VAT Payable / (Claimable):</span>
                      <span className="font-mono">{formatCurrency(pnl?.taxAndVat.netVatPayable ?? 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. GROSS MARGIN BREAKDOWN */}
        {activeTab === "margins" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-xl border border-border p-1 bg-surface">
                  {(["drug", "category", "supplier", "branch"] as const).map((group) => (
                    <button
                      key={group}
                      onClick={() => setMarginGroupBy(group)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                        marginGroupBy === group
                          ? "bg-accent text-accent-foreground shadow-xs"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      By {group}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-secondary" />
                  <input
                    type="text"
                    placeholder="Search group label..."
                    value={marginSearch}
                    onChange={(e) => setMarginSearch(e.target.value)}
                    className="h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs text-text-primary focus:ring-1 focus:ring-accent outline-none w-48"
                  />
                </div>
              </div>

              <button
                onClick={() => handleExportCsv("margin")}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-2 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download Margin CSV
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text-primary capitalize">
                    Profitability Matrix ({marginGroupBy})
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Showing {filteredMarginItems.length} items. Overall Gross Margin: {marginReport?.overallMarginPercent ?? 0}%
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-emerald-500">
                    Total Profit: {formatCurrency(marginReport?.totalGrossProfit ?? 0)}
                  </div>
                  <div className="text-xs text-text-secondary font-mono">
                    Rev: {formatCurrency(marginReport?.totalRevenue ?? 0)} | COGS: {formatCurrency(marginReport?.totalCogs ?? 0)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2 text-text-secondary uppercase border-b border-border text-[11px]">
                    <tr>
                      <th className="py-3 px-4 text-left">Label / Entity</th>
                      <th className="py-3 px-4 text-right">Units Sold</th>
                      <th className="py-3 px-4 text-right">Revenue</th>
                      <th className="py-3 px-4 text-right">COGS</th>
                      <th className="py-3 px-4 text-right">Gross Profit</th>
                      <th className="py-3 px-4 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredMarginItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-secondary italic">
                          No sales data found for this selection.
                        </td>
                      </tr>
                    ) : (
                      filteredMarginItems.map((item: MarginReportItem) => (
                        <tr key={item.key} className="hover:bg-surface-2/50 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-text-primary">{item.label}</div>
                            {item.subLabel && <div className="text-[10px] text-text-secondary font-mono">{item.subLabel}</div>}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono">{item.quantity}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium">{formatCurrency(item.revenue)}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-text-secondary">{formatCurrency(item.cogs)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-500">
                            {formatCurrency(item.grossProfit)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.marginPercent >= 30 ? "bg-emerald-500/10 text-emerald-500" :
                              item.marginPercent >= 15 ? "bg-amber-500/10 text-amber-500" :
                              "bg-rose-500/10 text-rose-500"
                            }`}>
                              {item.marginPercent}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. LOSS REPORTS & INVENTORY SHRINKAGE */}
        {activeTab === "losses" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Total Quantified Loss
                </span>
                <div className="text-2xl font-bold font-mono text-danger">
                  {formatCurrency(lossReport?.summary.totalLoss ?? 0)}
                </div>
                <p className="text-xs text-text-secondary">Shrinkage + Expiries + Refunds</p>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Inventory Shrinkage
                </span>
                <div className="text-2xl font-bold font-mono text-amber-500">
                  {formatCurrency(lossReport?.summary.adjustmentLoss ?? 0)}
                </div>
                <p className="text-xs text-text-secondary">Negative stock adjustments</p>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Expiry Discards
                </span>
                <div className="text-2xl font-bold font-mono text-rose-500">
                  {formatCurrency(lossReport?.summary.expiryLoss ?? 0)}
                </div>
                <p className="text-xs text-text-secondary">Discarded expired medicines</p>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Customer Refunds
                </span>
                <div className="text-2xl font-bold font-mono text-text-primary">
                  {formatCurrency(lossReport?.summary.customerRefunds ?? 0)}
                </div>
                <p className="text-xs text-text-secondary">{lossReport?.returnsCount ?? 0} return transactions</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <h3 className="text-sm font-bold text-text-primary">
                  Shrinkage Audit & Damaged Stock
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2 text-text-secondary uppercase border-b border-border text-[11px]">
                    <tr>
                      <th className="py-3 px-4 text-left">Product / Batch</th>
                      <th className="py-3 px-4 text-right">Units Lost</th>
                      <th className="py-3 px-4 text-right">Unit Cost</th>
                      <th className="py-3 px-4 text-right">Estimated Loss</th>
                      <th className="py-3 px-4 text-left">Reason</th>
                      <th className="py-3 px-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(lossReport?.adjustmentLosses ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-secondary italic">
                          No shrinkage or negative adjustments recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      (lossReport?.adjustmentLosses ?? []).map((item: LossItem) => (
                        <tr key={item.id} className="hover:bg-surface-2/50 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-text-primary">{item.productName}</div>
                            <div className="text-[10px] text-text-secondary font-mono">Batch: {item.batchNumber}</div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-danger font-medium">-{item.unitsLost}</td>
                          <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(item.unitCost)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-danger">{formatCurrency(item.estimatedLoss)}</td>
                          <td className="py-2.5 px-4 text-text-secondary">{item.reason}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-text-secondary">{new Date(item.date).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. REAL-TIME STOCK VALUATION */}
        {activeTab === "valuation" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">Stock Valuation (Cost vs Retail)</h3>
                <p className="text-xs text-text-secondary">
                  Valued across {valuation?.summary.totalActiveBatches ?? 0} active batches ({valuation?.summary.totalUnits ?? 0} units)
                </p>
              </div>
              <button
                onClick={() => handleExportCsv("valuation")}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-2 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download Valuation CSV
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Valuation at Cost
                </span>
                <div className="text-2xl font-bold font-mono text-amber-500">
                  {formatCurrency(valuation?.summary.totalCostValuation ?? 0)}
                </div>
                <p className="text-xs text-text-secondary">Asset purchase price value</p>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Valuation at Retail
                </span>
                <div className="text-2xl font-bold font-mono text-accent">
                  {formatCurrency(valuation?.summary.totalRetailValuation ?? 0)}
                </div>
                <p className="text-xs text-text-secondary">Selling price shelf value</p>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Potential Gross Profit
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-500">
                  {formatCurrency(valuation?.summary.potentialGrossProfit ?? 0)}
                </div>
                <p className="text-xs text-text-secondary">Expected margin upon sale</p>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Potential Margin %
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-500">
                  {valuation?.summary.potentialMarginPercent ?? 0}%
                </div>
                <p className="text-xs text-text-secondary">Overall inventory markup</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <Layers className="h-4 w-4 text-accent" />
                  <h4 className="text-sm font-bold text-text-primary">Valuation by Category</h4>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-2 text-text-secondary uppercase border-b border-border text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Category</th>
                        <th className="py-2.5 px-4 text-right">Units</th>
                        <th className="py-2.5 px-4 text-right">Cost Value</th>
                        <th className="py-2.5 px-4 text-right">Retail Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {(valuation?.byCategory ?? []).map((cat: StockValuationCategory, idx) => (
                        <tr key={idx} className="hover:bg-surface-2/40">
                          <td className="py-2 px-4 font-semibold text-text-primary">{cat.category}</td>
                          <td className="py-2 px-4 text-right font-mono">{cat.units}</td>
                          <td className="py-2 px-4 text-right font-mono text-amber-500">{formatCurrency(cat.costValue)}</td>
                          <td className="py-2 px-4 text-right font-mono font-medium">{formatCurrency(cat.retailValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Branch Breakdown */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <h4 className="text-sm font-bold text-text-primary">Valuation by Branch</h4>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-2 text-text-secondary uppercase border-b border-border text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Branch</th>
                        <th className="py-2.5 px-4 text-right">Units</th>
                        <th className="py-2.5 px-4 text-right">Cost Value</th>
                        <th className="py-2.5 px-4 text-right">Retail Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {(valuation?.byBranch ?? []).map((br: StockValuationBranch, idx) => (
                        <tr key={idx} className="hover:bg-surface-2/40">
                          <td className="py-2 px-4 font-semibold text-text-primary">{br.branchName}</td>
                          <td className="py-2 px-4 text-right font-mono">{br.units}</td>
                          <td className="py-2 px-4 text-right font-mono text-amber-500">{formatCurrency(br.costValue)}</td>
                          <td className="py-2 px-4 text-right font-mono font-medium">{formatCurrency(br.retailValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. SALES COGS LEDGER */}
        {activeTab === "cogs_ledger" && (
          <div className="p-6 rounded-2xl border border-border bg-surface shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  Accountant COGS & Tax Audit Ledger
                </h3>
                <p className="text-xs text-text-secondary">
                  Complete line-item export capturing batch unit cost, retail price, COGS, gross profit, and category VAT rates.
                </p>
              </div>

              <button
                onClick={() => handleExportCsv("sales_cogs")}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Download Full Ledger (CSV)
              </button>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border text-xs space-y-2">
              <div className="font-semibold text-text-primary flex items-center gap-2">
                <Scale className="h-4 w-4 text-accent" />
                Accounting Ledger Compliance Notes:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-text-secondary leading-relaxed">
                <li>Pairs every dispensed sale item with the exact batch from which it was allocated under FEFO.</li>
                <li>Preserves historical batch unit costs even if subsequent supplier batches are received at higher prices.</li>
                <li>Incorporates category-level VAT (0% for prescription medicines, configurable for OTC/cosmetics) and line VAT amounts.</li>
                <li>Ready for import into major accounting suites (SAP, Oracle NetSuite, QuickBooks, Xero).</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
