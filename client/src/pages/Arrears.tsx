import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Trash2, CheckCircle, Lock, Printer, History } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import StatusBadge from "@/components/shared/StatusBadge";
import DataTable from "@/components/shared/DataTable";
import InvoiceDetailDialog from "@/components/shared/InvoiceDetailDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Arrear, Customer, ArrearPayment } from "@/types";

export default function Arrears() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: "", totalBill: "", amountPaid: "" });
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; action: "pay" | "settle" | "delete"; targetId: string; payAmount?: number }>({ open: false, action: "pay", targetId: "" });
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [printDialog, setPrintDialog] = useState<{ open: boolean; saleId: string | null }>({ open: false, saleId: null });
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);

  const { data: arrears = [], isLoading } = useQuery({
    queryKey: ["arrears", filter],
    queryFn: () => api.arrears.list(filter === "all" ? undefined : filter),
  });

  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: api.customers.list });

  const recordPayment = useMutation({
    mutationFn: ({ id, amount, password }: { id: string; amount: number; password: string }) =>
      api.arrears.recordPayment(id, amount, password),
    onSuccess: (data) => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setPayingId(null);
      setPaymentAmount("");
      setPrintDialog({ open: true, saleId: data.paymentSaleId });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.arrears.create({
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
      setPrintDialog({ open: true, saleId: data.paymentSaleId });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  async function handleAdminAction(action: "pay" | "settle" | "delete") {
    setPasswordError("");
    const { targetId, payAmount } = passwordDialog;

    if (action === "pay" && payAmount) {
      recordPayment.mutate({ id: targetId, amount: payAmount, password: adminPassword });
    } else if (action === "settle") {
      settleMutation.mutate({ id: targetId, password: adminPassword });
    } else if (action === "delete") {
      deleteMutation.mutate(targetId);
    }
    setPasswordDialog({ open: false, action: "pay", targetId: "" });
    setAdminPassword("");
  }

  const totalOutstanding = arrears.filter((a: Arrear) => a.status === "pending").reduce((s: number, a: Arrear) => s + a.balance_due, 0);

  const columns = [
    { key: "customer_name", header: "Customer", cell: (a: Arrear) => <span className="font-medium text-text-primary">{a.customer_name}</span> },
    { key: "created_at", header: "Date", cell: (a: Arrear) => <span className="font-mono text-xs text-text-secondary">{formatDateTime(a.created_at)}</span> },
    { key: "total_bill", header: "Total Bill", cell: (a: Arrear) => <span className="font-mono">{formatCurrency(a.total_bill)}</span> },
    { key: "amount_paid", header: "Paid", cell: (a: Arrear) => <span className="font-mono">{formatCurrency(a.amount_paid)}</span> },
    { key: "balance_due", header: "Balance Due", cell: (a: Arrear) => <span className="font-mono font-medium text-warning">{formatCurrency(a.balance_due)}</span> },
    { key: "status", header: "Status", cell: (a: Arrear) => <StatusBadge status={a.status} />, className: "text-center" },
    {
      key: "actions", header: "Action", cell: (a: Arrear) => (
        <div className="flex items-center gap-1.5 justify-center">
          <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-secondary/60 transition-colors" title={expanded === a.id ? "Hide history" : "Payment history"}>
            <History className="h-3.5 w-3.5" />
          </button>
          {a.status === "pending" && (
            <>
              {payingId === a.id ? (
                <>
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={paymentAmount}
                    min="0.01"
                    max={a.balance_due}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="h-8 w-24 text-sm font-mono"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => { setPasswordDialog({ open: true, action: "pay", targetId: a.id, payAmount: Number(paymentAmount) }); setAdminPassword(""); }}
                    disabled={!paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > a.balance_due}
                  >Pay</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setPayingId(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setPayingId(a.id)}>Record Payment</Button>
                  <button onClick={() => { setPasswordDialog({ open: true, action: "settle", targetId: a.id }); setAdminPassword(""); }} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-success hover:bg-success/5 transition-colors" title="Mark Settled">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </>
          )}
          <button onClick={() => { setPasswordDialog({ open: true, action: "delete", targetId: a.id }); setAdminPassword(""); }} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ), className: "text-center",
    },
  ];

  return (
    <div>
      <PageHeader title="Arrears" description="Track and manage outstanding payments" action={{ label: "Add Arrear", onClick: () => { setForm({ customerId: "", totalBill: "", amountPaid: "" }); setOpen(true); } }} />
      <div className="mb-6">
        <StatCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={<CreditCard className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="all" onValueChange={(v) => { setFilter(v); setPayingId(null); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="settled">Settled</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl border border-border overflow-hidden">
        <DataTable columns={columns} data={arrears} loading={isLoading} keyExtractor={(a: Arrear) => a.id} />
      </div>

      {expanded && (() => {
        const arrear = arrears.find((a: Arrear) => a.id === expanded);
        if (!arrear) return null;
        const payments = arrear.payments ?? [];
        return (
          <div className="mt-3 rounded-xl border border-border overflow-hidden bg-bg-secondary/30">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
              <History className="h-4 w-4 text-text-secondary" />
              <span className="text-sm font-medium text-text-primary">Payment History — {arrear.customer_name}</span>
              <span className="text-xs text-text-secondary ml-auto font-mono">{payments.length} payment{payments.length !== 1 ? "s" : ""}</span>
            </div>
            {payments.length === 0 ? (
              <div className="text-center text-text-secondary py-8 text-xs">No payments recorded yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">Amount</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary">Running Total Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: ArrearPayment, i: number) => {
                      const runningTotal = payments.slice(0, i + 1).reduce((s, x) => s + x.amount, 0);
                      return (
                        <tr key={p.id} className="border-b border-border/40">
                          <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{formatDateTime(p.created_at)}</td>
                          <td className="px-4 py-2.5 font-mono font-medium text-success">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-2.5 font-mono text-text-primary">{formatCurrency(runningTotal)} / {formatCurrency(arrear.total_bill)}</td>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Arrear</DialogTitle></DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <Label>Customer</Label>
              <SearchableSelect
                options={customers.map((c: Customer) => ({ value: c.id, label: `${c.name} (${c.phone})` }))}
                value={form.customerId}
                onChange={(v) => setForm({ ...form, customerId: v })}
                placeholder="Select customer"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Total Bill</Label>
                <Input type="number" value={form.totalBill} onChange={(e) => setForm({ ...form, totalBill: e.target.value })} />
              </div>
              <div>
                <Label>Amount Paid (optional)</Label>
                <Input type="number" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" disabled={!form.customerId || !form.totalBill || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Adding..." : "Add Arrear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialog.open} onOpenChange={(o) => setPasswordDialog({ ...passwordDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Admin Password Required
            </DialogTitle>
            <DialogDescription>Enter your admin password to confirm this action.</DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
            {passwordError && <p className="text-sm text-danger">{passwordError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPasswordDialog({ open: false, action: "pay", targetId: "" })}>Cancel</Button>
              <Button onClick={() => handleAdminAction(passwordDialog.action)} disabled={!adminPassword}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={printDialog.open} onOpenChange={(o) => { if (!o) setPrintDialog({ open: false, saleId: null }); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print Receipt?
            </DialogTitle>
            <DialogDescription>Do you want to print the receipt for this payment?</DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setPrintDialog({ open: false, saleId: null })}>No</Button>
            <Button onClick={() => {
              setViewSaleId(printDialog.saleId);
              setPrintDialog({ open: false, saleId: null });
            }}>
              Yes, Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceDetailDialog
        open={!!viewSaleId}
        onOpenChange={(v) => { if (!v) setViewSaleId(null); }}
        saleId={viewSaleId}
      />
    </div>
  );
}
