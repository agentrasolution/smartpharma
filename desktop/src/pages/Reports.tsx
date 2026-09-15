import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, Package, Wallet, Undo2, CreditCard } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RevenueChart from "@/components/dashboard/RevenueChart";
import StatusBadge from "@/components/shared/StatusBadge";
import DataTable from "@/components/shared/DataTable";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import type { Product, Expense, Sale, ReturnEntry, Arrear } from "@/types";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: api.dashboard.stats,
  });

  const { data: productPage = { data: [] as Product[] } } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.list({ pageSize: 1000 }),
  });
  const products = productPage.data;

  const { data: allSales = [] } = useQuery({
    queryKey: ["sales", "recent", 500],
    queryFn: () => api.sales.listRecent(500),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: api.expenses.list,
  });

  const { data: returns = [] } = useQuery({
    queryKey: ["returns"],
    queryFn: api.returns.list,
  });

  const { data: arrears = [] } = useQuery({
    queryKey: ["arrears"],
    queryFn: () => api.arrears.list(),
  });

  const lowStockProducts = products.filter((p: Product) => p.stock_qty > 0 && p.stock_qty <= 5);
  const expiringProducts = products.filter((p: Product) => {
    if (!p.expiry) return false;
    const daysLeft = (new Date(p.expiry).getTime() - Date.now()) / 86400000;
    return daysLeft > 0 && daysLeft <= 30;
  });

  const filteredSales = allSales.filter((s: Sale) =>
    s.created_at >= dateRange.from && s.created_at <= dateRange.to + "T23:59:59"
  );
  const totalRevenue = filteredSales.reduce((sum: number, s: Sale) => sum + s.total, 0);

  const filteredExpenses = expenses.filter((e: Expense) =>
    e.date >= dateRange.from && e.date <= dateRange.to
  );
  const totalExpenses = filteredExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);

  const filteredReturns = returns.filter((r: ReturnEntry) =>
    r.created_at >= dateRange.from && r.created_at <= dateRange.to + "T23:59:59"
  );
  const totalRefunds = filteredReturns.reduce((sum: number, r: ReturnEntry) => sum + r.refund_amount, 0);

  const filteredArrears = arrears.filter((a: Arrear) =>
    a.created_at >= dateRange.from && a.created_at <= dateRange.to + "T23:59:59"
  );
  const totalOutstanding = filteredArrears.filter((a: Arrear) => a.status === "pending").reduce((sum: number, a: Arrear) => sum + a.balance_due, 0);
  const pendingArrears = filteredArrears.filter((a: Arrear) => a.status === "pending");

  const [chartPeriod, setChartPeriod] = useState<"week" | "month">("week");
  const chartData = chartPeriod === "week" ? (dashboardStats?.weekRevenue ?? []) : (dashboardStats?.monthRevenue ?? []);

  const lowStockColumns = [
    { key: "name", header: "Product", cell: (p: Product) => <span className="text-text-primary">{p.name}</span> },
    { key: "stock_qty", header: "Stock", cell: (p: Product) => <span className="font-mono text-danger font-medium">{p.stock_qty}</span> },
    { key: "threshold", header: "Threshold", cell: () => <span className="font-mono text-text-secondary">5</span> },
  ];

  const expiringColumns = [
    { key: "name", header: "Product", cell: (p: Product) => <span className="text-text-primary">{p.name}</span> },
    { key: "expiry", header: "Expiry", cell: (p: Product) => <span className="font-mono text-sm text-text-secondary">{formatDate(p.expiry)}</span> },
    {
      key: "days_left", header: "Days Left", cell: (p: Product) => {
        const daysLeft = p.expiry ? Math.ceil((new Date(p.expiry).getTime() - Date.now()) / 86400000) : 0;
        return <span className="font-mono text-danger font-medium">{daysLeft}</span>;
      },
    },
  ];

  const expenseColumns = [
    { key: "title", header: "Title", cell: (e: Expense) => <span className="text-text-primary">{e.title}</span> },
    { key: "category", header: "Category", cell: (e: Expense) => <span className="text-text-secondary">{e.category}</span> },
    { key: "amount", header: "Amount", cell: (e: Expense) => <span className="font-mono font-medium text-danger">{formatCurrency(e.amount)}</span> },
    { key: "date", header: "Date", cell: (e: Expense) => <span className="font-mono text-xs text-text-secondary">{formatDate(e.date)}</span> },
  ];

  const returnColumns = [
    { key: "created_at", header: "Date", cell: (r: ReturnEntry) => <span className="font-mono text-xs text-text-secondary">{formatDateTime(r.created_at)}</span> },
    { key: "sale_id", header: "Sale ID", cell: (r: ReturnEntry) => <span className="font-mono text-xs text-text-secondary">{r.sale_id}</span> },
    { key: "refund_amount", header: "Refund", cell: (r: ReturnEntry) => <span className="font-mono font-medium text-danger">{formatCurrency(r.refund_amount)}</span> },
    { key: "reason", header: "Reason", cell: (r: ReturnEntry) => <span className="text-text-secondary">{r.reason}</span> },
  ];

  const arrearColumns = [
    { key: "customer_name", header: "Customer", cell: (a: Arrear) => <span className="font-medium text-text-primary">{a.customer_name}</span> },
    { key: "created_at", header: "Date", cell: (a: Arrear) => <span className="font-mono text-xs text-text-secondary">{formatDateTime(a.created_at)}</span> },
    { key: "total_bill", header: "Total Bill", cell: (a: Arrear) => <span className="font-mono">{formatCurrency(a.total_bill)}</span> },
    { key: "amount_paid", header: "Paid", cell: (a: Arrear) => <span className="font-mono">{formatCurrency(a.amount_paid)}</span> },
    { key: "balance_due", header: "Balance", cell: (a: Arrear) => <span className="font-mono font-medium">{formatCurrency(a.balance_due)}</span> },
    { key: "status", header: "Status", cell: (a: Arrear) => <StatusBadge status={a.status} />, className: "text-center" },
  ];

  return (
    <div>
      <PageHeader title="Reports" description="Analyze your business performance" />

      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">From:</span>
          <Input type="date" value={dateRange.from} onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))} className="h-9 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">To:</span>
          <Input type="date" value={dateRange.to} onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))} className="h-9 w-40" />
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="mb-6">
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="stock">Stock Report</TabsTrigger>
          <TabsTrigger value="expense">Expense Report</TabsTrigger>
          <TabsTrigger value="returns">Returns Report</TabsTrigger>
          <TabsTrigger value="arrears">Arrears Report</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-text-secondary">Revenue (selected period)</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold font-mono">{formatCurrency(totalRevenue)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-text-secondary">Transactions</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold font-mono">{filteredSales.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-text-secondary">Total Expenses</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold font-mono">{formatCurrency(totalExpenses)}</p></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Revenue Trend ({chartPeriod === "week" ? "7 days" : "30 days"})</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button onClick={() => setChartPeriod("week")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartPeriod === "week" ? "bg-accent text-accent-foreground" : "text-text-secondary hover:text-text-primary"}`}>Week</button>
                  <button onClick={() => setChartPeriod("month")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartPeriod === "month" ? "bg-accent text-accent-foreground" : "text-text-secondary hover:text-text-primary"}`}>Month</button>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(`sales_report_${dateRange.from}_${dateRange.to}.csv`, ["Date","Customer","Items","Subtotal","Discount","Total","Paid","Change","Status"], filteredSales.map((s: Sale) => [s.created_at, s.customer_name||"Walk-in", s.items?.length||0, s.subtotal, s.discount, s.total, s.amount_paid, s.change, s.status]))}>
                  <Download className="h-4 w-4 mr-1" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadPDF(`sales_report_${dateRange.from}_${dateRange.to}.pdf`, "Sales Report", ["Date","Customer","Subtotal","Discount","Total","Paid","Status"], filteredSales.map((s: Sale) => [s.created_at, s.customer_name||"Walk-in", s.subtotal, s.discount, s.total, s.amount_paid, s.status]))}>
                  <Download className="h-4 w-4 mr-1" />PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RevenueChart data={chartData} period={chartPeriod} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => downloadCSV(`stock_report_${dateRange.from}_${dateRange.to}.csv`, ["Product","Stock","Expiry","Days Left"], [...lowStockProducts.map((p: Product) => [p.name, p.stock_qty, p.expiry||"", ""]), ...expiringProducts.map((p: Product) => [p.name, p.stock_qty, p.expiry||"", Math.ceil((new Date(p.expiry!).getTime() - Date.now()) / 86400000)])])}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadPDF(`stock_report_${dateRange.from}_${dateRange.to}.pdf`, "Stock Report", ["Product","Stock","Expiry","Days Left"], [...lowStockProducts.map((p: Product) => [p.name, p.stock_qty, p.expiry||"", ""]), ...expiringProducts.map((p: Product) => [p.name, p.stock_qty, p.expiry||"", Math.ceil((new Date(p.expiry!).getTime() - Date.now()) / 86400000)])])}>
              <Download className="h-4 w-4 mr-1" />PDF
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base font-semibold text-warning flex items-center gap-2"><Package className="h-4 w-4" />Low Stock Items (&le;5)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <DataTable columns={lowStockColumns} data={lowStockProducts} keyExtractor={(p: Product) => p.id} emptyMessage="No low stock items" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base font-semibold text-danger flex items-center gap-2"><Package className="h-4 w-4" />Expiring Items (30 days)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <DataTable columns={expiringColumns} data={expiringProducts} keyExtractor={(p: Product) => p.id} emptyMessage="No items expiring soon" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expense">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => downloadCSV(`expense_report_${dateRange.from}_${dateRange.to}.csv`, ["Title","Category","Amount","Date"], filteredExpenses.map((e: Expense) => [e.title, e.category, e.amount, e.date]))}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadPDF(`expense_report_${dateRange.from}_${dateRange.to}.pdf`, "Expense Report", ["Title","Category","Amount","Date"], filteredExpenses.map((e: Expense) => [e.title, e.category, e.amount, e.date]))}>
              <Download className="h-4 w-4 mr-1" />PDF
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Wallet className="h-4 w-4 text-text-secondary" />
                <CardTitle className="text-sm font-medium text-text-secondary">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold font-mono">{formatCurrency(totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <CardTitle className="text-sm font-medium text-text-secondary">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold font-mono text-success">{formatCurrency(Math.max(0, totalRevenue - totalExpenses))}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Expense Breakdown</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataTable columns={expenseColumns} data={filteredExpenses} keyExtractor={(e: Expense) => e.id} emptyMessage="No expenses in this period" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => downloadCSV(`returns_report_${dateRange.from}_${dateRange.to}.csv`, ["Date","Sale ID","Refund","Reason"], filteredReturns.map((r: ReturnEntry) => [r.created_at, r.sale_id, r.refund_amount, r.reason]))}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadPDF(`returns_report_${dateRange.from}_${dateRange.to}.pdf`, "Returns Report", ["Date","Sale ID","Refund","Reason"], filteredReturns.map((r: ReturnEntry) => [r.created_at, r.sale_id, r.refund_amount, r.reason]))}>
              <Download className="h-4 w-4 mr-1" />PDF
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Undo2 className="h-4 w-4 text-text-secondary" />
                <CardTitle className="text-sm font-medium text-text-secondary">Total Refunds</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold font-mono text-danger">{formatCurrency(totalRefunds)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Undo2 className="h-4 w-4 text-text-secondary" />
                <CardTitle className="text-sm font-medium text-text-secondary">Total Returns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold font-mono">{filteredReturns.length}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Return History</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataTable columns={returnColumns} data={filteredReturns} keyExtractor={(r: ReturnEntry) => r.id} emptyMessage="No returns in this period" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="arrears">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => downloadCSV(`arrears_report_${dateRange.from}_${dateRange.to}.csv`, ["Customer","Date","Total Bill","Paid","Balance","Status"], filteredArrears.map((a: Arrear) => [a.customer_name||"", a.created_at, a.total_bill, a.amount_paid, a.balance_due, a.status]))}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadPDF(`arrears_report_${dateRange.from}_${dateRange.to}.pdf`, "Arrears Report", ["Customer","Date","Total Bill","Paid","Balance","Status"], filteredArrears.map((a: Arrear) => [a.customer_name||"", a.created_at, a.total_bill, a.amount_paid, a.balance_due, a.status]))}>
              <Download className="h-4 w-4 mr-1" />PDF
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <CreditCard className="h-4 w-4 text-warning" />
                <CardTitle className="text-sm font-medium text-text-secondary">Outstanding Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold font-mono text-warning">{formatCurrency(totalOutstanding)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <CreditCard className="h-4 w-4 text-text-secondary" />
                <CardTitle className="text-sm font-medium text-text-secondary">Pending Arrears</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold font-mono">{pendingArrears.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <CreditCard className="h-4 w-4 text-text-secondary" />
                <CardTitle className="text-sm font-medium text-text-secondary">Total Arrears (period)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold font-mono">{filteredArrears.length}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Arrear Details</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataTable columns={arrearColumns} data={filteredArrears} keyExtractor={(a: Arrear) => a.id} emptyMessage="No arrears in this period" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
