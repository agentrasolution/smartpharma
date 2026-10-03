import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Factory, Building2, Phone, Package, Search, Plus, Pencil, Trash2,
  Download, LayoutGrid, List, Receipt, CreditCard, ArrowDownRight,
  ArrowUpRight, CheckCircle2, AlertCircle, X, DollarSign,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import { SearchableSelect } from "@/components/ui/searchable-select";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { Distributor, Company, DistributorLedger, RecordSupplierPaymentInput } from "@/types";

export default function Distributors() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", companyId: "" });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Ledger Statement modal state
  const [ledgerDistributor, setLedgerDistributor] = useState<Distributor | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<RecordSupplierPaymentInput>({
    amount: 0,
    paymentMethod: "CASH",
    referenceNumber: "",
    notes: "",
  });

  const { data: distributors = [], isLoading } = useQuery({ queryKey: ["distributors"], queryFn: api.distributors.list });
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: api.companies.list });

  // Query distributor ledger details when ledger modal is open
  const { data: ledgerData, isLoading: ledgerLoading, refetch: refetchLedger } = useQuery<DistributorLedger>({
    queryKey: ["distributor-ledger", ledgerDistributor?.id],
    queryFn: () => api.distributors.getLedger(ledgerDistributor!.id),
    enabled: !!ledgerDistributor,
  });

  const filtered = distributors.filter((d: Distributor) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );

  const createMutation = useMutation({
    mutationFn: () => api.distributors.create(form),
    onSuccess: () => {
      toast.success("Distributor created");
      queryClient.invalidateQueries({ queryKey: ["distributors"] });
      setOpen(false);
      setForm({ name: "", phone: "", companyId: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.distributors.update(editingId!, form),
    onSuccess: () => {
      toast.success("Distributor updated");
      queryClient.invalidateQueries({ queryKey: ["distributors"] });
      setOpen(false);
      setEditingId(null);
      setForm({ name: "", phone: "", companyId: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.distributors.delete(id),
    onSuccess: () => {
      toast.success("Distributor deleted");
      queryClient.invalidateQueries({ queryKey: ["distributors"] });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () => api.distributors.recordPayment(ledgerDistributor!.id, paymentForm),
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      refetchLedger();
      queryClient.invalidateQueries({ queryKey: ["purchaseInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["distributors"] });
      setPaymentModalOpen(false);
      setPaymentForm({ amount: 0, paymentMethod: "CASH", referenceNumber: "", notes: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", phone: "", companyId: "" });
    setOpen(true);
  }

  function openEdit(d: Distributor) {
    setEditingId(d.id);
    setForm({ name: d.name, phone: d.phone, companyId: (d as any).companyId || "" });
    setOpen(true);
  }

  function openLedger(d: Distributor) {
    setLedgerDistributor(d);
  }

  function openPayment() {
    if (!ledgerData) return;
    setPaymentForm({
      amount: ledgerData.summary.outstandingBalance > 0 ? ledgerData.summary.outstandingBalance : 0,
      paymentMethod: "CASH",
      referenceNumber: "",
      notes: "Account settlement payment",
    });
    setPaymentModalOpen(true);
  }

  const totalLinkedCompanies = new Set(distributors.map((d: Distributor) => d.company_name).filter(Boolean)).size;
  const totalSourcedProducts = distributors.reduce((acc: number, d: Distributor) => acc + (d.product_count || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distributors & Vendors"
        description="Manage your supplier network, wholesale vendor profiles, and Accounts Payable ledgers."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-accent/10 text-accent font-semibold border border-accent/20">
            {distributors.length} Vendors
          </span>
        }
        action={{ label: "Add Distributor", onClick: openAdd, icon: <Plus className="h-3.5 w-3.5" /> }}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Distributors"
          value={distributors.length}
          icon={<Factory className="h-5 w-5" />}
          color="accent"
          loading={isLoading}
          subtitle="Registered vendor partners"
        />
        <StatCard
          title="Linked Manufacturers"
          value={totalLinkedCompanies}
          icon={<Building2 className="h-5 w-5" />}
          color="purple"
          loading={isLoading}
          subtitle="Pharma companies supplied"
        />
        <StatCard
          title="Sourced Catalog Items"
          value={totalSourcedProducts}
          icon={<Package className="h-5 w-5" />}
          color="success"
          loading={isLoading}
          subtitle="Total product SKUs supplied"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-border/80 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            placeholder="Search distributor or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl text-xs bg-surface-2/40 border-border/80 focus:bg-surface"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            onClick={() => downloadCSV(`distributors_${new Date().toISOString().split("T")[0]}.csv`, ["Name","Contact Number","Company","Products"], filtered.map((d: Distributor) => [d.name, d.phone, d.company_name||"", d.product_count||0]))}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            onClick={() => downloadPDF(`distributors_${new Date().toISOString().split("T")[0]}.pdf`, "Distributors List", ["Name","Contact Number","Company","Products"], filtered.map((d: Distributor) => [d.name, d.phone, d.company_name||"", d.product_count||0]))}
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>

          <div className="flex items-center border border-border/80 rounded-xl overflow-hidden bg-surface-2/40 p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("p-1.5 rounded-lg transition-colors", viewMode === "grid" ? "bg-accent text-white shadow-xs" : "text-text-secondary hover:text-text-primary")}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 rounded-lg transition-colors", viewMode === "list" ? "bg-accent text-white shadow-xs" : "text-text-secondary hover:text-text-primary")}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "list" ? (
        <DataTable
          columns={[
            { key: "name", header: "Name", cell: (d: Distributor) => <span className="font-semibold text-text-primary">{d.name}</span> },
            { key: "phone", header: "Contact", cell: (d: Distributor) => <span className="font-mono text-xs text-text-secondary">{d.phone}</span> },
            { key: "company_name", header: "Company", cell: (d: Distributor) => <span className="text-text-secondary text-xs">{d.company_name || "—"}</span> },
            { key: "product_count", header: "Products", cell: (d: Distributor) => <span className="font-mono text-xs">{d.product_count ?? 0}</span> },
            {
              key: "actions", header: "", cell: (d: Distributor) => (
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openLedger(d)}
                    className="h-7 px-2.5 rounded-lg text-xs gap-1 border-accent/30 text-accent hover:bg-accent/10"
                  >
                    <Receipt className="h-3 w-3" />
                    Ledger
                  </Button>
                  <button onClick={() => openEdit(d)} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(d.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
          data={filtered}
          loading={isLoading}
          keyExtractor={(d: Distributor) => d.id}
          emptyTitle="No distributors found"
          emptyDescription={search ? `No distributors match "${search}".` : "Add wholesale distributors and vendors to manage payables and purchase shipments."}
          emptyAction={
            <Button onClick={openAdd} size="sm" className="h-9 rounded-xl text-xs gap-1.5 font-medium shadow-xs">
              <Plus className="h-3.5 w-3.5" /> Add Distributor
            </Button>
          }
        />
      ) : (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-surface p-8 shadow-xs">
              <EmptyState
                title="No distributors found"
                description={search ? `No distributors match "${search}". Try adjusting your search query.` : "Register your supply partners to track delivery history and running ledger balances."}
                icon={<Factory className="h-6 w-6 text-accent" />}
                action={
                  <Button onClick={openAdd} size="sm" className="h-9 rounded-xl text-xs gap-1.5 font-medium shadow-xs">
                    <Plus className="h-3.5 w-3.5" /> Add First Distributor
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((dist: Distributor) => (
                <div key={dist.id} className="group rounded-2xl border border-border/80 bg-surface p-5 shadow-xs hover:shadow-md hover:border-accent/30 transition-all duration-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                          <Factory className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-text-primary truncate text-sm">{dist.name}</h3>
                          <div className="space-y-1.5 mt-2.5">
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                              <Phone className="h-3 w-3 shrink-0 text-text-secondary/70" />
                              <span className="font-mono">{dist.phone}</span>
                            </div>
                            {dist.company_name && (
                              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                <Building2 className="h-3 w-3 shrink-0 text-text-secondary/70" />
                                <span className="truncate">{dist.company_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                              <Package className="h-3 w-3 shrink-0 text-text-secondary/70" />
                              <span>{dist.product_count ?? 0} products supplied</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => openEdit(dist)} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(dist.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLedger(dist)}
                      className="w-full text-xs font-medium gap-1.5 h-8 rounded-xl border-accent/30 text-accent hover:bg-accent/10"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      View Statement & Ledger
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Distributor Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingId(null); } setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Distributor" : "Add Distributor"}</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <Label>Distributor Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Company</Label>
              <SearchableSelect
                options={companies.map((c: Company) => ({ value: c.id, label: c.name }))}
                value={form.companyId}
                onChange={(v) => setForm({ ...form, companyId: v })}
                placeholder="Select company"
              />
            </div>
            <div>
              <Label>Contact Number</Label>
              <Input inputMode="numeric" pattern="[0-9]*" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })} />
            </div>
            <Button className="w-full" disabled={!form.name || createMutation.isPending || updateMutation.isPending}
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update Distributor" : "Add Distributor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Ledger & Running Statement Dialog */}
      <Dialog open={!!ledgerDistributor} onOpenChange={(v) => { if (!v) setLedgerDistributor(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Factory className="h-5 w-5 text-accent" />
                  {ledgerDistributor?.name} — Accounts Payable Ledger
                </DialogTitle>
                <p className="text-xs text-text-secondary mt-1">
                  Contact: {ledgerDistributor?.phone} {ledgerData?.distributor?.companyName ? `• Company: ${ledgerData.distributor.companyName}` : ""}
                </p>
              </div>
              <Button size="sm" onClick={openPayment} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <CreditCard className="h-4 w-4" />
                Record Payment
              </Button>
            </div>
          </DialogHeader>

          {ledgerLoading ? (
            <div className="p-8 text-center space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : ledgerData ? (
            <div className="px-5 pb-5 space-y-5">
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-surface-2 border-border">
                  <CardContent className="p-4">
                    <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">Total Billed / Invoiced</p>
                    <p className="text-xl font-bold font-mono text-text-primary mt-1">{formatCurrency(ledgerData.summary.totalInvoiced)}</p>
                    <p className="text-[11px] text-text-secondary mt-1">{ledgerData.summary.totalInvoicesCount} invoices delivered</p>
                  </CardContent>
                </Card>
                <Card className="bg-surface-2 border-border">
                  <CardContent className="p-4">
                    <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">Total Paid</p>
                    <p className="text-xl font-bold font-mono text-emerald-500 mt-1">{formatCurrency(ledgerData.summary.totalPaid)}</p>
                    <p className="text-[11px] text-text-secondary mt-1">{ledgerData.payments.length} payments recorded</p>
                  </CardContent>
                </Card>
                <Card className={cn("border", ledgerData.summary.outstandingBalance > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30")}>
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">Balance Owed (AP)</p>
                    <p className={cn("text-xl font-bold font-mono mt-1", ledgerData.summary.outstandingBalance > 0 ? "text-amber-500" : "text-emerald-500")}>
                      {formatCurrency(ledgerData.summary.outstandingBalance)}
                    </p>
                    <p className="text-[11px] text-text-secondary mt-1">
                      {ledgerData.summary.unpaidInvoicesCount > 0 ? `${ledgerData.summary.unpaidInvoicesCount} unpaid/partial invoices` : "All accounts settled"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Chronological Statement Timeline */}
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center justify-between">
                  <span>Running Statement (Chronological Ledger)</span>
                  <span className="text-xs text-text-secondary font-normal font-mono">{ledgerData.statement.length} entries</span>
                </h4>
                {ledgerData.statement.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-border rounded-xl text-text-secondary text-sm">
                    No transactions recorded for this supplier yet.
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto max-h-[360px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-2 text-text-secondary border-b border-border sticky top-0 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Reference / Description</th>
                            <th className="py-2.5 px-3 text-right">Debit (+ Owed)</th>
                            <th className="py-2.5 px-3 text-right">Credit (- Paid)</th>
                            <th className="py-2.5 px-3 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {ledgerData.statement.map((entry) => (
                            <tr key={entry.id} className="hover:bg-surface-2/50 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-text-secondary">{formatDate(entry.date)}</td>
                              <td className="py-2.5 px-3">
                                {entry.type === "INVOICE" ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400">
                                    <ArrowDownRight className="h-3 w-3" /> INVOICE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                                    <ArrowUpRight className="h-3 w-3" /> PAYMENT
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-text-primary">
                                <div>{entry.description}</div>
                                {entry.status && <span className="text-[10px] text-text-secondary font-mono">Status: {entry.status}</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-medium text-text-primary">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-500">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary">
                                {formatCurrency(entry.runningBalance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Record Payment Sub-Dialog */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Record Supplier Payment
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-4">
            <div className="p-3 rounded-lg bg-surface-2 border border-border text-xs">
              <div className="text-text-secondary">Distributor</div>
              <div className="font-semibold text-text-primary text-sm mt-0.5">{ledgerDistributor?.name}</div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                <span className="text-text-secondary">Current Balance Owed:</span>
                <span className="font-mono font-bold text-amber-500">{formatCurrency(ledgerData?.summary.outstandingBalance)}</span>
              </div>
            </div>

            <div>
              <Label>Payment Amount</Label>
              <Input
                type="number"
                min="0.01"
                step="any"
                value={paymentForm.amount || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Payment Method</Label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-border bg-surface-1 text-sm text-text-primary"
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <Label>Reference Number (Cheque # / Transfer ID)</Label>
              <Input
                value={paymentForm.referenceNumber || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                placeholder="e.g. TXN-940284"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={paymentForm.notes || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="e.g. Partial settlement for invoice #..."
              />
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={paymentForm.amount <= 0 || paymentMutation.isPending}
              onClick={() => paymentMutation.mutate()}
            >
              {paymentMutation.isPending ? "Recording Payment..." : `Confirm Payment of ${formatCurrency(paymentForm.amount)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Distributor"
        description="Are you sure you want to delete this distributor? Associated products and stock entries will not be affected."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
