import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp, AlertCircle, Package, Clock, Plus, ShoppingCart, Users,
  Wallet, ArrowRight, AlertTriangle, UserCheck, CreditCard, Eye
} from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import DonutChart from "@/components/dashboard/DonutChart";
import RecentSalesTable from "@/components/dashboard/RecentSalesTable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const statVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: "easeOut" },
  }),
};

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Dashboard() {
  const navigate = useNavigate();
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

  const topCustomers = customers
    .filter((c) => c.total_purchases && c.total_purchases > 0)
    .sort((a, b) => (b.total_purchases || 0) - (a.total_purchases || 0))
    .slice(0, 5);

  const pendingArrears = arrears
    .filter((a) => a.status === "pending")
    .sort((a, b) => b.balance_due - a.balance_due)
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          {
            title: "Today's Revenue",
            value: stats?.todayRevenue ?? 0,
            icon: <TrendingUp className="h-4 w-4" />,
            href: "/invoices",
            subtitle: "View all invoices",
          },
          {
            title: "Outstanding Arrears",
            value: stats?.totalArrears ?? 0,
            icon: <AlertCircle className="h-4 w-4" />,
            href: "/arrears",
            subtitle: "Collect payments",
          },
          {
            title: "Low Stock Items",
            value: stats?.lowStockCount ?? 0,
            icon: <Package className="h-4 w-4" />,
            href: "/stock",
            subtitle: "Restock needed",
          },
          {
            title: "Expiring Soon",
            value: stats?.expiringSoonCount ?? 0,
            icon: <Clock className="h-4 w-4" />,
            href: "/products",
            subtitle: "Check inventory",
          },
        ] as const).map((item, i) => (
          <motion.div
            key={item.title}
            custom={i}
            variants={statVariants}
            initial="hidden"
            animate="visible"
          >
            <StatCard
              title={item.title}
              value={item.value}
              icon={item.icon}
              subtitle={item.subtitle}
              href={item.href}
              onClick={() => navigate(item.href)}
              delay={0}
            />
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Sale", icon: ShoppingCart, href: "/pos", color: "bg-accent/10 text-accent hover:bg-accent/20" },
            { label: "Add Product", icon: Package, href: "/products", color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" },
            { label: "Add Customer", icon: Users, href: "/customers", color: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" },
            { label: "Record Expense", icon: Wallet, href: "/expenses", color: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" },
          ].map((action) => (
            <motion.button
              key={action.label}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.href)}
              className={`flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:shadow-md transition-all duration-200 ${action.color}`}
            >
              <div className="h-10 w-10 rounded-lg bg-current/10 flex items-center justify-center">
                <action.icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold">{action.label}</p>
                <p className="text-[10px] opacity-60">Quick action</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={stats?.weekRevenue} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>By sales volume</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={stats?.topProducts} />
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low Stock Alert */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-sm">Low Stock Alert</CardTitle>
                  <CardDescription className="text-[11px]">Products need restocking</CardDescription>
                </div>
              </div>
              <button
                onClick={() => navigate("/stock")}
                className="text-[11px] text-accent hover:text-accent/80 font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-xs text-text-secondary py-4 text-center">All products are well stocked</p>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => navigate("/stock")}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product.name}</p>
                        <p className="text-[10px] text-text-secondary">{product.barcode}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${product.stock_qty <= 5 ? "text-danger" : "text-amber-500"}`}>
                          {product.stock_qty} left
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Expiring Soon Alert */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-sm">Expiring Soon</CardTitle>
                  <CardDescription className="text-[11px]">Within next 30 days</CardDescription>
                </div>
              </div>
              <button
                onClick={() => navigate("/products")}
                className="text-[11px] text-accent hover:text-accent/80 font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              {expiringProducts.length === 0 ? (
                <p className="text-xs text-text-secondary py-4 text-center">No products expiring soon</p>
              ) : (
                <div className="space-y-2">
                  {expiringProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => navigate("/products")}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product.name}</p>
                        <p className="text-[10px] text-text-secondary">{product.stock_qty} in stock</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-orange-500">
                          {product.expiry ? new Date(product.expiry).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Customers & Pending Arrears */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Customers */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-sm">Top Customers</CardTitle>
                  <CardDescription className="text-[11px]">By total purchases</CardDescription>
                </div>
              </div>
              <button
                onClick={() => navigate("/customers")}
                className="text-[11px] text-accent hover:text-accent/80 font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <p className="text-xs text-text-secondary py-4 text-center">No customer data yet</p>
              ) : (
                <div className="space-y-2">
                  {topCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-emerald-500">
                            {customer.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{customer.name}</p>
                          <p className="text-[10px] text-text-secondary">{customer.phone || "No phone"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-500">
                          {formatCurrency(customer.total_purchases || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Arrears */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-rose-500" />
                </div>
                <div>
                  <CardTitle className="text-sm">Pending Arrears</CardTitle>
                  <CardDescription className="text-[11px]">Outstanding payments</CardDescription>
                </div>
              </div>
              <button
                onClick={() => navigate("/arrears")}
                className="text-[11px] text-accent hover:text-accent/80 font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              {pendingArrears.length === 0 ? (
                <p className="text-xs text-text-secondary py-4 text-center">No pending arrears</p>
              ) : (
                <div className="space-y-2">
                  {pendingArrears.map((arrear) => (
                    <div
                      key={arrear.id}
                      onClick={() => navigate("/arrears")}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-rose-500">
                            {(arrear.customer_name || "C").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{arrear.customer_name || "Unknown"}</p>
                          <p className="text-[10px] text-text-secondary">Bill: {formatCurrency(arrear.total_bill)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-rose-500">
                          {formatCurrency(arrear.balance_due)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Sales */}
      <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>Latest transactions</CardDescription>
            </div>
            <button
              onClick={() => navigate("/invoices")}
              className="text-[11px] text-accent hover:text-accent/80 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent>
            <RecentSalesTable />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
