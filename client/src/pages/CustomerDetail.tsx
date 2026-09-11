import { useState, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, CreditCard, Lock, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import { api } from "@/lib/api";
import type { Sale, Arrear, ArrearPayment } from "@/types";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.customers.getById(id!),
    enabled: !!id,
  });

  const [expandedArrear, setExpandedArrear] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; targetId: string; amount: number | null }>({ open: false, targetId: "", amount: null });
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const recordPayment = useMutation({
    mutationFn: ({ arrearId, amount, password }: { arrearId: string; amount: number; password: string }) =>
      api.arrears.recordPayment(arrearId, amount, password),
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setPayingId(null);
      setPaymentAmount("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ arrearId, password }: { arrearId: string; password: string }) =>
      api.arrears.settle(arrearId, password),
    onSuccess: () => {
      toast.success("Arrear settled");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleAdminAction() {
    setPasswordError("");
    const { targetId, amount } = passwordDialog;
    if (amount != null) {
      recordPayment.mutate({ arrearId: targetId, amount, password: adminPassword });
    } else {
      settleMutation.mutate({ arrearId: targetId, password: adminPassword });
    }
    setPasswordDialog({ open: false, targetId: "", amount: null });
    setAdminPassword("");
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary">Customer not found</p>
        <Button variant="link" onClick={() => navigate("/customers")}>Back to Customers</Button>
      </div>
    );
  }

  const purchaseColumns = [
    { key: "date", header: "Date", cell: (s: Sale) => <span className="font-mono text-xs text-text-secondary">{formatDate(s.created_at)}</span> },
    { key: "items", header: "Items", cell: (s: Sale) => <span className="text-text-secondary">{s.items?.length ?? 0} items</span> },
    { key: "total", header: "Total", cell: (s: Sale) => <span className="font-mono font-medium">{formatCurrency(s.total)}</span> },
    { key: "paid", header: "Paid", cell: (s: Sale) => <span className="font-mono">{formatCurrency(s.amount_paid)}</span> },
    { key: "status", header: "Status", cell: (s: Sale) => <StatusBadge status={s.status} />, className: "text-center" },
  ];

  const paymentHistoryColumns = [
    { key: "date", header: "Payment Date", cell: (p: ArrearPayment) => <span className="font-mono text-xs text-text-secondary">{formatDateTime(p.created_at)}</span> },
    { key: "amount", header: "Amount", cell: (p: ArrearPayment) => <span className="font-mono font-medium text-success">{formatCurrency(p.amount)}</span> },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="gap-1.5 text-text-secondary">
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{customer.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
            <ShoppingBag className="h-3.5 w-3.5" />
            {customer.phone}
          </div>
          {(customer.father_name || customer.father_phone) && (
            <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
              <ShoppingBag className="h-3.5 w-3.5" />
              Father: {customer.father_name || "\u2014"}
              {customer.father_phone ? ` \u00b7 ${customer.father_phone}` : ""}
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
              <ShoppingBag className="h-3.5 w-3.5" />
              {customer.address}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Purchases" value={customer.total_purchases ?? customer.purchases?.length ?? 0} icon={<ShoppingBag className="h-5 w-5" />} />
        <StatCard title="Total Spent" value={formatCurrency(customer.purchases?.reduce((s: number, p: Sale) => s + p.total, 0) ?? 0)} icon={<ShoppingBag className="h-5 w-5" />} />
        <StatCard title="Outstanding Arrear" value={formatCurrency(customer.outstanding_arrear ?? 0)} icon={<ShoppingBag className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          <TabsTrigger value="arrears">Arrear History</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases">
          <Card>
            <CardContent className="p-0">
              <DataTable columns={purchaseColumns} data={(customer.purchases ?? []) as Sale[]} keyExtractor={(s: Sale) => s.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="arrears">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Date", "Total Bill", "Paid", "Balance", "Status", "Payments", "Action"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-text-secondary whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(customer.arrears ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-text-secondary py-10 text-xs">
                          No arrears found
                        </td>
                      </tr>
                    ) : (customer.arrears ?? []).map((a: Arrear) => (
                      <Fragment key={a.id}>
                        <tr className="border-b border-border/60 hover:bg-bg-secondary/40">
                          <td className="px-4 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">{formatDate(a.created_at)}</td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">{formatCurrency(a.total_bill)}</td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">{formatCurrency(a.amount_paid)}</td>
                          <td className="px-4 py-3 font-mono font-medium text-warning whitespace-nowrap">{formatCurrency(a.balance_due)}</td>
                          <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                          <td className="px-4 py-3">
                            {(a.payments?.length ?? 0) > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-xs"
                                onClick={() => setExpandedArrear(expandedArrear === a.id ? null : a.id)}
                              >
                                {expandedArrear === a.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                {a.payments?.length} payment{(a.payments?.length ?? 0) > 1 ? "s" : ""}
                              </Button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {a.status === "pending" && (
                              payingId === a.id ? (
                                <div className="flex items-center gap-1.5">
                                  <Input type="number" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="h-8 w-24 text-sm font-mono" autoFocus />
                                  <Button size="sm" className="h-8" disabled={!paymentAmount || recordPayment.isPending}
                                    onClick={() => { setPasswordDialog({ open: true, targetId: a.id, amount: Number(paymentAmount) }); setAdminPassword(""); }}>
                                    Pay
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setPayingId(null)}>Cancel</Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Button size="sm" variant="outline" className="h-8" onClick={() => setPayingId(a.id)}>Record Payment</Button>
                                  <button onClick={() => { setPasswordDialog({ open: true, targetId: a.id, amount: null }); setAdminPassword(""); }} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-success hover:bg-success/5 transition-colors" title="Mark Settled">
                                    <CreditCard className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )
                            )}
                          </td>
                        </tr>
                        {expandedArrear === a.id && (a.payments?.length ?? 0) > 0 && (
                          <tr className="bg-bg-secondary/30">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="rounded-lg border border-border/60 overflow-hidden">
                                <DataTable columns={paymentHistoryColumns} data={a.payments ?? []} keyExtractor={(p: ArrearPayment) => p.id} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={passwordDialog.open} onOpenChange={(o) => setPasswordDialog({ ...passwordDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Admin Password Required
            </DialogTitle>
            <DialogDescription>Enter your admin password to confirm this payment.</DialogDescription>
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
              <Button variant="outline" onClick={() => setPasswordDialog({ open: false, targetId: "", amount: null })}>Cancel</Button>
              <Button onClick={handleAdminAction} disabled={!adminPassword}>
                {(recordPayment.isPending || settleMutation.isPending) ? "Confirming..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
