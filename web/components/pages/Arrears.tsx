"use client";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Plus,
  Trash2,
  CheckCircle,
  Lock,
  Printer,
  History,
  Search,
  Download,
  AlertTriangle,
  Users,
  X,
  DollarSign,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import StatusBadge from "@/components/shared/StatusBadge";
import DataTable from "@/components/shared/DataTable";
import InvoiceDetailDialog from "@/components/shared/InvoiceDetailDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import type { Arrear, Customer, ArrearPayment } from "@/types";

export default function Arrears() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "settled">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", totalBill: "", amountPaid: "" });

  // Dialog states
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    arrear: Arrear | null;
    amount: string;
    password: string;
  }>({ open: false, arrear: null, amount: "", password: "" });

  const [settleDialog, setSettleDialog] = useState<{
    open: boolean;
    arrear: Arrear | null;
    password: string;
  }>({ open: false, arrear: null, password: "" });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    arrear: Arrear | null;
    password: string;
  }>({ open: false, arrear: null, password: "" });

  const [printDialog, setPrintDialog] = useState<{ open: boolean; saleId: string | null }>({ open: false, saleId: null });
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);

  // Fetch all arrears so metrics and tabs remain accurate and fast
  const { data: arrears = [], isLoading } = useQuery({
    queryKey: ["arrears"],
    queryFn: () => api.arrears.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers.list,
  });

  const recordPayment = useMutation({
    mutationFn: ({ id, amount, password }: { id: string; amount: number; password: string }) =>
      api.arrears.recordPayment(id, amount, password),
    onSuccess: (data) => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setPaymentDialog({ open: false, arrear: null, amount: "", password: "" });
      setPrintDialog({ open: true, saleId: data.paymentSaleId });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.arrears.create({
        customerId: form.customerId,
        totalBill: Number(form.totalBill),
        amountPaid: form.amountPaid ? Number(form.amountPaid) : 0,
      }),
    onSuccess: () => {
      toast.success("Arrear added");
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setForm({ customerId: "", totalBill: "", amountPaid: "" });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.arrears.delete(id),
    onSuccess: () => {
      toast.success("Arrear deleted");
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDeleteDialog({ open: false, arrear: null, password: "" });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.arrears.settle(id, password),
    onSuccess: (data) => {
      toast.success("Arrear settled");
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setSettleDialog({ open: false, arrear: null, password: "" });
      setPrintDialog({ open: true, saleId: data.paymentSaleId });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // KPI Calculations
  const pendingArrears = useMemo(
    () => arrears.filter((a: Arrear) => a.status === "pending"),
    [arrears]
  );
  const settledArrears = useMemo(
    () => arrears.filter((a: Arrear) => a.status === "settled"),
    [arrears]
  );

  const totalOutstanding = useMemo(
    () => pendingArrears.reduce((s: number, a: Arrear) => s + (a.balance_due || 0), 0),
    [pendingArrears]
  );

  const overdue30Days = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return pendingArrears.filter((a: Arrear) => new Date(a.created_at).getTime() < thirtyDaysAgo);
  }, [pendingArrears]);

  const overdueAmount = useMemo(
    () => overdue30Days.reduce((s: number, a: Arrear) => s + (a.balance_due || 0), 0),
    [overdue30Days]
  );

  const activeDebtorsCount = useMemo(() => {
    return new Set(pendingArrears.map((a: Arrear) => a.customer_id || a.customer_name)).size;
  }, [pendingArrears]);

  // Filtering & Pagination
  const filtered = useMemo(() => {
    return arrears.filter((a: Arrear) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (a.customer_name && a.customer_name.toLowerCase().includes(q)) ||
        (a.id && a.id.toLowerCase().includes(q))
      );
    });
  }, [arrears, filter, search]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function handleFilterChange(newFilter: "all" | "pending" | "settled") {
    setFilter(newFilter);
    setPage(1);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  function openPayment(a: Arrear) {
    setPaymentDialog({
      open: true,
      arrear: a,
      amount: String(a.balance_due),
      password: "",
    });
  }

  function openSettle(a: Arrear) {
    setSettleDialog({
      open: true,
      arrear: a,
      password: "",
    });
  }

  function openDelete(a: Arrear) {
    setDeleteDialog({
      open: true,
      arrear: a,
      password: "",
    });
  }

  const columns = [
    {
      key: "customer_name",
      header: "Customer",
      cell: (a: Arrear) => (
        <div>
          <span className="font-semibold text-text-primary text-sm">{a.customer_name}</span>
          <p className="text-[11px] text-text-secondary font-mono mt-0.5">ID: {a.id.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Date Recorded",
      cell: (a: Arrear) => (
        <span className="font-mono text-xs text-text-secondary">{formatDateTime(a.created_at)}</span>
      ),
    },
    {
      key: "total_bill",
      header: "Total Bill",
      cell: (a: Arrear) => <span className="font-mono text-xs font-medium text-text-primary">{formatCurrency(a.total_bill)}</span>,
    },
    {
      key: "amount_paid",
      header: "Paid",
      cell: (a: Arrear) => <span className="font-mono text-xs text-success font-medium">{formatCurrency(a.amount_paid)}</span>,
    },
    {
      key: "balance_due",
      header: "Balance Due",
      cell: (a: Arrear) => (
        <span className={cn("font-mono text-xs font-bold", a.balance_due > 0 ? "text-warning" : "text-text-secondary")}>
          {formatCurrency(a.balance_due)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (a: Arrear) => <StatusBadge status={a.status} />,
      className: "text-center",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (a: Arrear) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(expanded === a.id ? null : a.id)}
            className={cn("h-7 px-2 text-xs rounded-lg gap-1 border border-transparent", expanded === a.id && "bg-accent/10 text-accent border-accent/20")}
            title={expanded === a.id ? "Hide history" : "Payment history"}
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden md:inline">History</span>
          </Button>

          {a.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs rounded-lg border-border/80 hover:bg-surface-2 gap-1 font-medium"
                onClick={() => openPayment(a)}
              >
                <DollarSign className="h-3.5 w-3.5 text-success" />
                <span>Pay</span>
              </Button>
              <button
                onClick={() => openSettle(a)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-success hover:bg-success/5 transition-colors"
                title="Mark Settled"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          <button
            onClick={() => openDelete(a)}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
            title="Delete Arrear"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Arrears"
        description="Track credit balances, overdue customer accounts, and record payment recoveries."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-warning/10 text-warning font-semibold border border-warning/20">
            {pendingArrears.length} Pending Accounts
          </span>
        }
        action={{
          label: "Add Arrear",
          onClick: () => {
            setForm({ customerId: "", totalBill: "", amountPaid: "" });
            setOpen(true);
          },
          icon: <Plus className="h-3.5 w-3.5" />,
        }}
      />

      {/* Balanced 3-Card Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(totalOutstanding)}
          icon={<CreditCard className="h-5 w-5" />}
          color="warning"
          loading={isLoading}
          subtitle={`${pendingArrears.length} pending receivables`}
        />
        <StatCard
          title="Overdue > 30 Days"
          value={formatCurrency(overdueAmount)}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="danger"
          loading={isLoading}
          subtitle={`${overdue30Days.length} delinquent accounts`}
        />
        <StatCard
          title="Active Debtors"
          value={activeDebtorsCount}
          icon={<Users className="h-5 w-5" />}
          color="accent"
          loading={isLoading}
          subtitle="Customers with balances"
        />
      </div>

      {/* Standardized Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <Input
              placeholder="Search customer name or ID..."
              value={search}
              onChange={handleSearchChange}
              className="pl-9 h-9 rounded-xl text-xs bg-surface-2/40 border-border/80 focus:bg-surface"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center p-0.5 bg-surface-2/60 rounded-xl border border-border/60">
            <button
              onClick={() => handleFilterChange("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-surface text-text-primary shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              All ({arrears.length})
            </button>
            <button
              onClick={() => handleFilterChange("pending")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === "pending"
                  ? "bg-surface text-warning shadow-xs font-semibold"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              Pending ({pendingArrears.length})
            </button>
            <button
              onClick={() => handleFilterChange("settled")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === "settled"
                  ? "bg-surface text-success shadow-xs font-semibold"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              Settled ({settledArrears.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            onClick={() =>
              downloadCSV(
                `arrears_${new Date().toISOString().split("T")[0]}.csv`,
                ["Customer", "Date", "Total Bill", "Paid", "Balance Due", "Status"],
                filtered.map((a: Arrear) => [
                  a.customer_name,
                  formatDateTime(a.created_at),
                  formatCurrency(a.total_bill),
                  formatCurrency(a.amount_paid),
                  formatCurrency(a.balance_due),
                  a.status.toUpperCase(),
                ])
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            onClick={() =>
              downloadPDF(
                `arrears_${new Date().toISOString().split("T")[0]}.pdf`,
                "Customer Arrears Report",
                ["Customer", "Date", "Total Bill", "Paid", "Balance Due", "Status"],
                filtered.map((a: Arrear) => [
                  a.customer_name,
                  formatDateTime(a.created_at),
                  formatCurrency(a.total_bill),
                  formatCurrency(a.amount_paid),
                  formatCurrency(a.balance_due),
                  a.status.toUpperCase(),
                ])
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        loading={isLoading}
        keyExtractor={(a: Arrear) => a.id}
        emptyTitle="No arrears records found"
        emptyDescription={
          search
            ? `No records match "${search}". Try adjusting your search term.`
            : filter !== "all"
            ? `No ${filter} arrears found.`
            : "No customer debt recorded yet. When sales are made on credit, they will appear here."
        }
        emptyIcon={<CreditCard className="h-6 w-6 text-accent" />}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={filtered.length}
        itemLabel="arrears"
      />

      {/* Payment History View */}
      {expanded && (() => {
        const arrear = arrears.find((a: Arrear) => a.id === expanded);
        if (!arrear) return null;
        const payments = arrear.payments ?? [];
        return (
          <div className="rounded-2xl border border-border/80 overflow-hidden bg-surface shadow-xs">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/80 bg-surface-2/40">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-text-primary">Payment History — {arrear.customer_name}</h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    Original Bill: {formatCurrency(arrear.total_bill)} • Current Due: {formatCurrency(arrear.balance_due)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary font-mono bg-surface px-2 py-0.5 rounded-md border border-border/60">
                  {payments.length} payment{payments.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setExpanded(null)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {payments.length === 0 ? (
              <div className="text-center text-text-secondary py-8 text-xs">No partial payments recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-surface-2/20">
                      <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-text-secondary uppercase">Date</th>
                      <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-text-secondary uppercase">Amount Paid</th>
                      <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-text-secondary uppercase">Running Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: ArrearPayment, i: number) => {
                      const runningTotal = payments.slice(0, i + 1).reduce((s, x) => s + x.amount, 0);
                      return (
                        <tr key={p.id} className="border-b border-border/40 hover:bg-surface-2/20 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-text-secondary">{formatDateTime(p.created_at)}</td>
                          <td className="px-5 py-3 font-mono font-semibold text-xs text-success">{formatCurrency(p.amount)}</td>
                          <td className="px-5 py-3 font-mono text-xs text-text-primary">
                            {formatCurrency(runningTotal)} / {formatCurrency(arrear.total_bill)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Add Arrear Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Customer Arrear</DialogTitle>
            <DialogDescription>Record a new manual credit balance or unpaid bill for a customer.</DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-4">
            <div>
              <Label className="text-xs font-medium">Customer</Label>
              <div className="mt-1">
                <SearchableSelect
                  options={customers.map((c: Customer) => ({ value: c.id, label: `${c.name} (${c.phone || "No phone"})` }))}
                  value={form.customerId}
                  onChange={(v) => setForm({ ...form, customerId: v })}
                  placeholder="Select customer..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Total Bill Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.totalBill}
                  onChange={(e) => setForm({ ...form, totalBill: e.target.value })}
                  className="mt-1 h-9 rounded-xl font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Amount Paid (Optional)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amountPaid}
                  onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                  className="mt-1 h-9 rounded-xl font-mono text-xs"
                />
              </div>
            </div>
            <Button
              className="w-full h-9 rounded-xl text-xs font-medium shadow-xs"
              disabled={!form.customerId || !form.totalBill || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Adding..." : "Add Arrear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={paymentDialog.open}
        onOpenChange={(o) => {
          if (!o) setPaymentDialog({ open: false, arrear: null, amount: "", password: "" });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              Record Arrear Payment
            </DialogTitle>
            <DialogDescription>
              Record an installment or full recovery for {paymentDialog.arrear?.customer_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-4">
            <div className="p-3 rounded-xl bg-surface-2/60 border border-border/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-text-secondary">Current Balance Due</p>
                <p className="text-base font-bold font-mono text-warning">
                  {paymentDialog.arrear ? formatCurrency(paymentDialog.arrear.balance_due) : "$0.00"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg"
                onClick={() =>
                  paymentDialog.arrear &&
                  setPaymentDialog((prev) => ({ ...prev, amount: String(prev.arrear?.balance_due || "") }))
                }
              >
                Pay Full Balance
              </Button>
            </div>

            <div>
              <Label className="text-xs font-medium">Payment Amount</Label>
              <Input
                type="number"
                min="0.01"
                max={paymentDialog.arrear?.balance_due}
                value={paymentDialog.amount}
                onChange={(e) => setPaymentDialog((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="mt-1 h-9 rounded-xl font-mono text-xs"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-text-secondary" />
                Admin Password
              </Label>
              <Input
                type="password"
                value={paymentDialog.password}
                onChange={(e) => setPaymentDialog((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Enter admin password to authorize"
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl text-xs"
                onClick={() => setPaymentDialog({ open: false, arrear: null, amount: "", password: "" })}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-9 rounded-xl text-xs font-medium shadow-xs"
                disabled={
                  !paymentDialog.amount ||
                  Number(paymentDialog.amount) <= 0 ||
                  (paymentDialog.arrear && Number(paymentDialog.amount) > paymentDialog.arrear.balance_due) ||
                  !paymentDialog.password ||
                  recordPayment.isPending
                }
                onClick={() => {
                  if (paymentDialog.arrear && paymentDialog.amount && paymentDialog.password) {
                    recordPayment.mutate({
                      id: paymentDialog.arrear.id,
                      amount: Number(paymentDialog.amount),
                      password: paymentDialog.password,
                    });
                  }
                }}
              >
                {recordPayment.isPending ? "Recording..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Settled Dialog */}
      <Dialog
        open={settleDialog.open}
        onOpenChange={(o) => {
          if (!o) setSettleDialog({ open: false, arrear: null, password: "" });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Settle Customer Arrear
            </DialogTitle>
            <DialogDescription>
              Mark the remaining balance of {settleDialog.arrear ? formatCurrency(settleDialog.arrear.balance_due) : ""} for {settleDialog.arrear?.customer_name} as fully settled.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-4">
            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-text-secondary" />
                Admin Password
              </Label>
              <Input
                type="password"
                value={settleDialog.password}
                onChange={(e) => setSettleDialog((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Enter admin password to confirm"
                className="mt-1 h-9 rounded-xl text-xs"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl text-xs"
                onClick={() => setSettleDialog({ open: false, arrear: null, password: "" })}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-9 rounded-xl text-xs font-medium shadow-xs bg-success text-white hover:bg-success/90"
                disabled={!settleDialog.password || settleMutation.isPending}
                onClick={() => {
                  if (settleDialog.arrear && settleDialog.password) {
                    settleMutation.mutate({
                      id: settleDialog.arrear.id,
                      password: settleDialog.password,
                    });
                  }
                }}
              >
                {settleMutation.isPending ? "Settling..." : "Mark as Settled"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Arrear Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(o) => {
          if (!o) setDeleteDialog({ open: false, arrear: null, password: "" });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <Trash2 className="h-5 w-5" />
              Delete Arrear Record
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this arrear record for {deleteDialog.arrear?.customer_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs"
              onClick={() => setDeleteDialog({ open: false, arrear: null, password: "" })}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-9 rounded-xl text-xs font-medium shadow-xs"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteDialog.arrear) {
                  deleteMutation.mutate(deleteDialog.arrear.id);
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Receipt Prompt */}
      <Dialog
        open={printDialog.open}
        onOpenChange={(o) => {
          if (!o) setPrintDialog({ open: false, saleId: null });
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-accent" />
              Print Payment Receipt?
            </DialogTitle>
            <DialogDescription>
              Would you like to print or view the receipt voucher for this payment transaction?
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs"
              onClick={() => setPrintDialog({ open: false, saleId: null })}
            >
              Skip
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-xl text-xs font-medium shadow-xs"
              onClick={() => {
                setViewSaleId(printDialog.saleId);
                setPrintDialog({ open: false, saleId: null });
              }}
            >
              Print Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceDetailDialog
        open={!!viewSaleId}
        onOpenChange={(v) => {
          if (!v) setViewSaleId(null);
        }}
        saleId={viewSaleId}
      />
    </div>
  );
}
