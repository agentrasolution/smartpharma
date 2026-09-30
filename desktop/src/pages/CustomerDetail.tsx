import { useState, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ChevronDown, ChevronUp, CreditCard, Lock, ShoppingBag,
  HeartPulse, ShieldCheck, AlertTriangle, Plus, RefreshCw, MessageSquare,
  FileText, Download, CheckCircle2, Phone, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import { api } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import type { Sale, Arrear, ArrearPayment, ChronicMedication } from "@/types";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.customers.getById(id!),
    enabled: !!id,
  });

  const { data: statement, isLoading: statementLoading } = useQuery({
    queryKey: ["customer-statement", id],
    queryFn: () => api.customers.getStatement(id!),
    enabled: !!id,
  });

  const [expandedArrear, setExpandedArrear] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; targetId: string; amount: number | null }>({
    open: false,
    targetId: "",
    amount: null,
  });
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Add Chronic Medication dialog
  const [addMedOpen, setAddMedOpen] = useState(false);
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("Once daily");
  const [medDaysSupply, setMedDaysSupply] = useState("30");
  const [medNotes, setMedNotes] = useState("");

  // Contact / Refill dialogs
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<ChronicMedication | null>(null);
  const [contactNotes, setContactNotes] = useState("");
  const [refillDialogOpen, setRefillDialogOpen] = useState(false);
  const [refillDaysSupply, setRefillDaysSupply] = useState("30");
  const [refillNotes, setRefillNotes] = useState("");

  const recordPayment = useMutation({
    mutationFn: ({ arrearId, amount, password }: { arrearId: string; amount: number; password: string }) =>
      api.arrears.recordPayment(arrearId, amount, password),
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customer-statement", id] });
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setPayingId(null);
      setPaymentAmount("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const settleMutation = useMutation({
    mutationFn: ({ arrearId, password }: { arrearId: string; password: string }) =>
      api.arrears.settle(arrearId, password),
    onSuccess: () => {
      toast.success("Arrear settled");
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customer-statement", id] });
      queryClient.invalidateQueries({ queryKey: ["arrears"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addChronicMutation = useMutation({
    mutationFn: () =>
      api.customers.addChronic({
        customerId: id!,
        medicationName: medName,
        dosage: medDosage,
        frequency: medFrequency,
        daysSupply: Number(medDaysSupply) || 30,
        notes: medNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["refill-queue"] });
      setAddMedOpen(false);
      setMedName("");
      setMedDosage("");
      setMedFrequency("Once daily");
      setMedDaysSupply("30");
      setMedNotes("");
      toast.success("Chronic medication added");
    },
    onError: (err) => toast.error(err.message),
  });

  const contactMutation = useMutation({
    mutationFn: ({ medId, notes }: { medId: string; notes: string }) =>
      api.customers.recordContact(medId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["refill-queue"] });
      setContactDialogOpen(false);
      setSelectedMed(null);
      setContactNotes("");
      toast.success("Contact attempt logged");
    },
    onError: (err) => toast.error(err.message),
  });

  const refillMutation = useMutation({
    mutationFn: ({ medId, daysSupply, notes }: { medId: string; daysSupply: number; notes: string }) =>
      api.customers.recordRefill(medId, { daysSupply, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["refill-queue"] });
      setRefillDialogOpen(false);
      setSelectedMed(null);
      setRefillNotes("");
      toast.success("Refill recorded & schedule updated");
    },
    onError: (err) => toast.error(err.message),
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
    { key: "id", header: "Invoice #", cell: (s: Sale) => <span className="font-mono text-xs text-text-secondary">{s.id}</span> },
    { key: "date", header: "Date", cell: (s: Sale) => <span className="font-mono text-xs text-text-secondary">{formatDate(s.created_at)}</span> },
    {
      key: "tender",
      header: "Tender",
      cell: (s: Sale) => (
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border">
          {s.payment_method || "CASH"}
        </span>
      ),
    },
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
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="gap-1.5 text-text-secondary">
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </Button>

      {/* Patient Profile Card */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{customer.name}</h1>
              {customer.consent_given ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 px-2.5 py-0.5 rounded-full border border-success/20">
                  <ShieldCheck className="h-3.5 w-3.5" /> Consent Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 px-2.5 py-0.5 rounded-full border border-warning/20">
                  <AlertTriangle className="h-3.5 w-3.5" /> Consent Pending
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-text-secondary">
              <span className="font-mono">Phone: {customer.phone}</span>
              {customer.national_id && <span className="font-mono">National ID: {customer.national_id}</span>}
              {customer.gender && <span>Gender: {customer.gender}</span>}
              {customer.blood_group && <span>Blood: {customer.blood_group}</span>}
              {customer.address && <span>Address: {customer.address}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddMedOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Chronic Med
            </Button>
          </div>
        </div>

        {/* Clinical Alerts Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60">
          <div className="p-3 rounded-lg bg-surface-2/40 border border-border/60">
            <span className="text-[11px] font-semibold text-danger block mb-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Known Allergies
            </span>
            {(customer.allergies?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {customer.allergies?.map((all: string, idx: number) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-xs font-medium bg-danger/10 text-danger border border-danger/20">
                    {all}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-text-secondary">No recorded allergies.</span>
            )}
          </div>

          <div className="p-3 rounded-lg bg-surface-2/40 border border-border/60">
            <span className="text-[11px] font-semibold text-purple-400 block mb-1.5 flex items-center gap-1">
              <HeartPulse className="h-3.5 w-3.5" /> Chronic Medical Conditions
            </span>
            {(customer.chronic_conditions?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {customer.chronic_conditions?.map((cond: string, idx: number) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {cond}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-text-secondary">No recorded chronic conditions.</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard title="Total Purchases" value={customer.total_purchases ?? customer.purchases?.length ?? 0} icon={<ShoppingBag className="h-5 w-5" />} />
        <StatCard title="Outstanding Arrears" value={formatCurrency(customer.outstanding_arrear ?? 0)} icon={<CreditCard className="h-5 w-5" />} />
        <StatCard title="Credit Limit" value={formatCurrency(customer.credit_limit ?? 0)} icon={<CreditCard className="h-5 w-5" />} />
        <StatCard title="Active Chronic Meds" value={customer.active_chronic_meds ?? customer.chronic_medications?.length ?? 0} icon={<HeartPulse className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="purchases">
        <TabsList className="grid grid-cols-4 w-full sm:w-[540px]">
          <TabsTrigger value="purchases">Invoices</TabsTrigger>
          <TabsTrigger value="arrears">Arrears & Payments</TabsTrigger>
          <TabsTrigger value="chronic">Chronic Meds</TabsTrigger>
          <TabsTrigger value="statement">Account Statement</TabsTrigger>
        </TabsList>

        {/* Tab 1: Purchases */}
        <TabsContent value="purchases" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <DataTable columns={purchaseColumns} data={(customer.purchases ?? []) as Sale[]} keyExtractor={(s: Sale) => s.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Arrears */}
        <TabsContent value="arrears" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/40">
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

        {/* Tab 3: Chronic Medications */}
        <TabsContent value="chronic" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Chronic Medication Schedule</h3>
              <p className="text-xs text-text-secondary">Automated refill tracking and adherence monitoring</p>
            </div>
            <Button size="sm" className="gap-1 text-xs" onClick={() => setAddMedOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Medication
            </Button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/40">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Medication</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Dosage & Frequency</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Supply</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Last Dispensed</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Next Refill</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(customer.chronic_medications ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-xs text-text-secondary">
                      No chronic medications recorded for this patient.
                    </td>
                  </tr>
                ) : (
                  (customer.chronic_medications ?? []).map((med) => {
                    const daysRemaining = med.days_remaining ?? 0;
                    const urgencyClass =
                      daysRemaining < 0
                        ? "bg-danger/10 text-danger border-danger/30"
                        : daysRemaining === 0
                        ? "bg-warning/10 text-warning border-warning/30"
                        : daysRemaining <= 7
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "bg-surface-2 text-text-secondary border-border";

                    return (
                      <tr key={med.id} className="hover:bg-surface-2/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-xs text-text-primary">{med.medication_name}</div>
                          {med.notes && <div className="text-[10px] text-text-secondary italic">{med.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {med.dosage} {med.frequency ? `\u2022 ${med.frequency}` : ""}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{med.days_supply} days</td>
                        <td className="px-4 py-3 font-mono text-xs text-text-secondary">{formatDate(med.last_dispensed_date)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-text-secondary">{formatDate(med.next_refill_date)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", urgencyClass)}>
                            {daysRemaining < 0
                              ? `${Math.abs(daysRemaining)}d Overdue`
                              : daysRemaining === 0
                              ? "Due Today"
                              : `${daysRemaining}d Left`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1"
                              onClick={() => {
                                setSelectedMed(med);
                                setContactNotes(med.contact_notes || "");
                                setContactDialogOpen(true);
                              }}
                            >
                              <MessageSquare className="h-3 w-3" /> Contact
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-[11px] gap-1 bg-accent text-accent-foreground hover:bg-accent-hover"
                              onClick={() => {
                                setSelectedMed(med);
                                setRefillDaysSupply(String(med.days_supply || 30));
                                setRefillNotes("");
                                setRefillDialogOpen(true);
                              }}
                            >
                              <RefreshCw className="h-3 w-3" /> Refill
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab 4: Account Statement & Ledger */}
        <TabsContent value="statement" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Customer Ledger & Account Statement</h3>
              <p className="text-xs text-text-secondary">Chronological audit trail of credit sales and settlements</p>
            </div>
            {statement && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() =>
                    downloadCSV(
                      `statement_${customer.id}_${new Date().toISOString().split("T")[0]}.csv`,
                      ["Date", "Reference", "Description", "Debit", "Credit", "Running Balance"],
                      statement.entries.map((e) => [
                        e.date,
                        e.reference,
                        e.description,
                        e.debit,
                        e.credit,
                        e.runningBalance,
                      ])
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Export Statement (CSV)
                </Button>
              </div>
            )}
          </div>

          {statementLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : !statement || statement.entries.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-secondary bg-surface rounded-xl border border-border">
              No credit transactions or arrears recorded on this account.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-border bg-surface-2/40">
                  <span className="text-[11px] text-text-secondary block">Total Billed on Credit</span>
                  <span className="text-base font-mono font-bold text-text-primary">{formatCurrency(statement.summary.total_billed)}</span>
                </div>
                <div className="p-3 rounded-lg border border-border bg-surface-2/40">
                  <span className="text-[11px] text-text-secondary block">Total Settled</span>
                  <span className="text-base font-mono font-bold text-success">{formatCurrency(statement.summary.total_paid)}</span>
                </div>
                <div className="p-3 rounded-lg border border-border bg-surface-2/40">
                  <span className="text-[11px] text-text-secondary block">Outstanding Balance</span>
                  <span className="text-base font-mono font-bold text-warning">{formatCurrency(statement.summary.current_balance)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/40">
                      <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Reference</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Description</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-text-secondary">Debit (Billed)</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-text-secondary">Credit (Paid)</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-text-secondary">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {statement.entries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-surface-2/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-text-secondary">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-text-primary">{entry.reference}</td>
                        <td className="px-4 py-3 text-xs text-text-secondary">{entry.description}</td>
                        <td className="px-4 py-3 font-mono text-xs text-right font-medium">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-right text-success font-medium">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-right font-bold text-text-primary">
                          {formatCurrency(entry.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Chronic Medication Dialog */}
      <Dialog open={addMedOpen} onOpenChange={setAddMedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4 text-accent" />
              Add Chronic Medication Regimen
            </DialogTitle>
            <DialogDescription>
              Record an ongoing prescription for automated refill alerts.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Medication Name *</Label>
              <Input
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="e.g. Amlodipine 5mg / Metformin 500mg"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dosage Instructions</Label>
                <Input
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  placeholder="e.g. 1 tablet"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Frequency</Label>
                <select
                  value={medFrequency}
                  onChange={(e) => setMedFrequency(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="Once daily">Once daily</option>
                  <option value="Twice daily">Twice daily</option>
                  <option value="Three times daily">Three times daily</option>
                  <option value="At bedtime">At bedtime</option>
                  <option value="With meals">With meals</option>
                  <option value="As needed">As needed</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Days Supply</Label>
              <Input
                type="number"
                value={medDaysSupply}
                onChange={(e) => setMedDaysSupply(e.target.value)}
                placeholder="30"
                className="h-8 text-xs font-mono"
              />
              <span className="text-[10px] text-text-secondary">Refill will automatically trigger every {medDaysSupply} days.</span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Special Instructions / Notes</Label>
              <Textarea
                value={medNotes}
                onChange={(e) => setMedNotes(e.target.value)}
                placeholder="e.g. Prescribed by Dr. Faisal for hypertension"
                className="h-16 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddMedOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => addChronicMutation.mutate()} disabled={!medName.trim() || addChronicMutation.isPending}>
              Add to Regimen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Contact Reminder Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-accent" />
              Log Refill Reminder Contact
            </DialogTitle>
            <DialogDescription>
              Record communication attempt for {selectedMed?.medication_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Contact Outcome Notes</Label>
              <Textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                placeholder="e.g. Contacted via phone; patient confirmed pickup tomorrow."
                className="h-20 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => selectedMed && contactMutation.mutate({ medId: selectedMed.id, notes: contactNotes })}
              disabled={!contactNotes.trim() || contactMutation.isPending}
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Refill Dispensed Dialog */}
      <Dialog open={refillDialogOpen} onOpenChange={setRefillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 text-success" />
              Dispense Chronic Refill
            </DialogTitle>
            <DialogDescription>
              Advance chronic medication schedule for {selectedMed?.medication_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Days Supply for this Refill</Label>
              <Input
                type="number"
                value={refillDaysSupply}
                onChange={(e) => setRefillDaysSupply(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Refill Notes</Label>
              <Input
                value={refillNotes}
                onChange={(e) => setRefillNotes(e.target.value)}
                placeholder="e.g. Dispensed 30-day supply"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRefillDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() =>
                selectedMed &&
                refillMutation.mutate({
                  medId: selectedMed.id,
                  daysSupply: Number(refillDaysSupply) || 30,
                  notes: refillNotes,
                })
              }
              disabled={refillMutation.isPending}
            >
              Confirm Refill & Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Confirmation Dialog */}
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
