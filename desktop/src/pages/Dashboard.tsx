import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp, AlertCircle, Package, Clock, Plus, ShoppingCart, Users,
  Wallet, ArrowRight, AlertTriangle, UserCheck, CreditCard, Eye, Info,
  ChevronDown, CheckCircle2, RefreshCw, Sparkles, Filter
} from "lucide-react";
import MoyasarAreaChart from "@/components/dashboard/MoyasarAreaChart";
import MoyasarDonutCard, { DonutBreakdownItem } from "@/components/dashboard/MoyasarDonutCard";
import RecentSalesTable from "@/components/dashboard/RecentSalesTable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const sectionVariants: any = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: api.dashboard.stats,
  });

  const { data: productPage } = useQuery({
    queryKey: ["products-page"],
    queryFn: () => api.products.list({ pageSize: 500 }),
  });
  const products = productPage?.data ?? [];

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: api.customers.list,
  });

  const { data: arrears = [] } = useQuery({
    queryKey: ["arrears-list"],
    queryFn: () => api.arrears.list(),
  });

  const lowStockProducts = products
    .filter((p) => p.active && p.stock_qty > 0 && p.stock_qty <= 10)
    .sort((a, b) => a.stock_qty - b.stock_qty)
    .slice(0, 5);

  const expiringProducts = products
    .filter((p) => {
      if (!p.expiry || !p.active) return false;
      const expiryDate = new Date(p.expiry);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiryDate <= thirtyDaysFromNow;
    })
    .slice(0, 5);

  const todayRevenue = stats?.todayRevenue ?? 27380;
  const hourlyEstimate = Math.round((todayRevenue / 14) * 0.85);

  // Payment Breakdown for Moyasar Donut
  const paymentBreakdownItems: DonutBreakdownItem[] = [
    { name: "Apple Pay", value: 86.04, percentage: 86.04, color: "#10B981" },
    { name: "Mada / Debit Card", value: 13.44, percentage: 13.44, color: "#3B82F6" },
    { name: "Cash In Hand", value: 0.37, percentage: 0.37, color: "#F59E0B" },
    { name: "Insurance / STC Pay", value: 0.15, percentage: 0.15, color: "#8B5CF6" },
  ];

  // Sales Status Breakdown for Moyasar Donut
  const salesStatusItems: DonutBreakdownItem[] = [
    { name: "Paid Volume", value: 99.19, percentage: 99.19, color: "#3B82F6" },
    { name: "Refunded / Returns", value: 0.81, percentage: 0.81, color: "#F59E0B" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[480px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Skeleton className="h-60 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* ======================================================== */}
      {/* MOYASAR HERO CARD: TODAY OVERVIEW + MULTI-LAYER CHART   */}
      {/* ======================================================== */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        className="bg-surface border border-border/80 rounded-2xl shadow-xs overflow-hidden"
      >
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-text-primary tracking-tight">Today Overview</h2>
            <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
              <span>+ 1.55%</span>
              <Info className="h-3 w-3 opacity-70 cursor-help" />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate("/invoices")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-surface hover:bg-surface-2 text-text-primary text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            >
              Today's Payments
            </button>
            <button
              onClick={() => navigate("/pos")}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-accent-foreground text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Live POS Register
            </button>
          </div>
        </div>

        {/* Key Metrics Row (Hourly Value, Gross Value, Filter) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 pt-5 pb-2 border-b border-border/30">
          {/* Hourly Value */}
          <div className="text-left">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
              Hourly Value
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-text-secondary">SAR</span>
              <span className="text-2xl font-bold font-display text-text-primary tracking-tight">
                {hourlyEstimate > 1000 ? `${(hourlyEstimate / 1000).toFixed(2)}K` : hourlyEstimate}
              </span>
            </div>
            <p className="text-[11px] text-text-secondary/70 mt-0.5">02:00 PM – now</p>
          </div>

          {/* Gross Value */}
          <div className="text-left">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
              Gross Value
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-text-secondary">SAR</span>
              <span className="text-2xl font-bold font-display text-text-primary tracking-tight">
                {todayRevenue > 1000 ? `${(todayRevenue / 1000).toFixed(2)}K` : todayRevenue.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-text-secondary/70 mt-0.5">Today's Balance</p>
          </div>

          {/* Payment Status Dropdown Selector */}
          <div className="flex flex-col md:items-end justify-center">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1 md:text-right">
              Payment Status
            </p>
            <div className="relative inline-block">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="appearance-none bg-surface-2 border border-border rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
              >
                <option value="all">All Transactions</option>
                <option value="mada">Paid (Mada)</option>
                <option value="applePay">Apple Pay</option>
                <option value="cash">Cash In Hand</option>
                <option value="insurance">Insurance & Claims</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Moyasar Multi-Layer Gradient Wave Chart */}
        <div className="px-6 py-4">
          <MoyasarAreaChart filterStatus={paymentFilter} currency="SAR" />
        </div>

        {/* Bottom Section: Dual Donut Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 border-t border-border/40 bg-surface-2/30">
          <MoyasarDonutCard
            title="Tender Method Volume"
            totalLabel="Total Volume"
            totalValue="131,897"
            items={paymentBreakdownItems}
          />
          <MoyasarDonutCard
            title="Fulfillment Quality"
            totalLabel="Total Volume"
            totalValue="132,972"
            items={salesStatusItems}
          />
        </div>
      </motion.div>

      {/* ======================================================== */}
      {/* SECONDARY ROW: CLINICAL & INVENTORY ACTION TILES         */}
      {/* ======================================================== */}
      <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[
            { label: "New POS Sale", icon: ShoppingCart, href: "/pos", badge: "F1", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
            { label: "Dispense Rx", icon: Plus, href: "/dispensing", badge: "Clinical", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
            { label: "Batch Receiving", icon: Package, href: "/stock", badge: "F7", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
            { label: "Record Expense", icon: Wallet, href: "/expenses", badge: "F9", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.href)}
              className="group flex items-center justify-between p-4 rounded-xl border border-border/80 bg-surface hover:border-primary/40 hover:shadow-xs transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center border ${action.color}`}>
                  <action.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {action.label}
                  </p>
                  <p className="text-[10px] text-text-secondary">Quick action</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-text-secondary bg-surface-2 px-1.5 py-0.5 rounded-md border border-border/60">
                {action.badge}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ======================================================== */}
      {/* ALERT MONITORING ROW: LOW STOCK & NEAR EXPIRY BATCHES    */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low Stock Warning */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="h-full border-border/80 rounded-2xl shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Low Stock Threshold</CardTitle>
                  <CardDescription className="text-[11px]">Items requiring purchase replenishment</CardDescription>
                </div>
              </div>
              <button
                onClick={() => navigate("/stock")}
                className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                Reorder <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <div className="text-center py-6 text-text-secondary text-xs">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  All pharmacy inventory levels are optimal
                </div>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => navigate("/stock")}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 hover:bg-surface-2 cursor-pointer transition-colors border border-border/40"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-xs font-semibold text-text-primary truncate">{product.name}</p>
                        <p className="text-[10px] text-text-secondary font-mono">{product.barcode || "No barcode"}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 text-xs font-bold font-mono rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          {product.stock_qty} units left
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Expiring Batches Warning */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="h-full border-border/80 rounded-2xl shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Near Expiry FEFO Batches</CardTitle>
                  <CardDescription className="text-[11px]">Batches expiring within next 30 days</CardDescription>
                </div>
              </div>
              <button
                onClick={() => navigate("/inventory")}
                className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                Scan FEFO <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              {expiringProducts.length === 0 ? (
                <div className="text-center py-6 text-text-secondary text-xs">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  No medication batches expiring within 30 days
                </div>
              ) : (
                <div className="space-y-2">
                  {expiringProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => navigate("/inventory")}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 hover:bg-surface-2 cursor-pointer transition-colors border border-border/40"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-xs font-semibold text-text-primary truncate">{product.name}</p>
                        <p className="text-[10px] text-text-secondary">In stock: {product.stock_qty}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold font-mono rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          {product.expiry ? new Date(product.expiry).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ======================================================== */}
      {/* RECENT SALES STREAM TABLE                                */}
      {/* ======================================================== */}
      <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <RecentSalesTable />
      </motion.div>
    </div>
  );
}
