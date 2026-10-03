"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type {
  PurchaseInvoice,
  Product,
  Distributor,
  CreatePurchaseInvoiceInput,
  PurchaseInvoiceItemInput,
  RecordSupplierPaymentInput,
  DistributorLedger,
} from "@/types";
import {
  Receipt,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  CreditCard,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Package,
} from "lucide-react";

interface ItemRowDraft extends PurchaseInvoiceItemInput {
  tempId: string;
  productName?: string;
}

export default function PurchasesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // State
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Create Invoice Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [invoiceHeader, setInvoiceHeader] = useState<{
    distributorId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT";
    discount: number;
    tax: number;
    paidAmount: number;
    notes: string;
  }>({
    distributorId: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    paymentMethod: "CREDIT",
    discount: 0,
    tax: 0,
    paidAmount: 0,
    notes: "",
  });

  const [itemRows, setItemRows] = useState<ItemRowDraft[]>([
    {
      tempId: "row-1",
      productId: "",
      batchNumber: "",
      expiryDate: "",
      quantityPacks: 1,
      unitsPerPack: 1,
      unitCost: 0,
      salePrice: 0,
    },
  ]);

  // View Invoice Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  // Pay Invoice Modal
  const [payInvoice, setPayInvoice] = useState<PurchaseInvoice | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState<RecordSupplierPaymentInput>({
    amount: 0,
    paymentMethod: "CASH",
    referenceNumber: "",
    notes: "",
  });

  // Distributor Ledger Drawer
  const [ledgerDistributor, setLedgerDistributor] = useState<Distributor | null>(null);
  const [ledgerData, setLedgerData] = useState<DistributorLedger | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Status message
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Auth gate
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Load Data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [invRes, prodRes, distRes] = await Promise.all([
        api.purchaseInvoices.list(),
        api.products.list({ pageSize: 1000 }),
        api.distributors.list(),
      ]);
      setInvoices(invRes || []);
      setProducts(prodRes?.data || []);
      setDistributors(distRes || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to load purchasing data", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loadData]);

  // Open Distributor Ledger
  const openDistributorLedger = async (dist: Distributor) => {
    setLedgerDistributor(dist);
    setLoadingLedger(true);
    try {
      const res = await api.distributors.getLedger(dist.id);
      setLedgerData(res);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to load supplier ledger", "error");
    } finally {
      setLoadingLedger(false);
    }
  };

  // Live calculation for create modal
  const subtotal = itemRows.reduce((acc, row) => acc + (row.quantityPacks * (row.unitCost || 0)), 0);
  const grandTotal = Math.max(0, subtotal - (invoiceHeader.discount || 0) + (invoiceHeader.tax || 0));
  const remainingDue = Math.max(0, grandTotal - (invoiceHeader.paidAmount || 0));

  // Metrics
  const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balanceDue, 0);
  const paidCount = invoices.filter((i) => i.status === "PAID").length;
  const unpaidCount = invoices.filter((i) => i.status !== "PAID" && i.status !== "VOID").length;

  // Filtered invoices
  const filtered = invoices.filter((inv) => {
    const matchesSearch = !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.distributorName && inv.distributorName.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle Product select in row
  const handleProductSelect = (tempId: string, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setItemRows((prev) =>
      prev.map((row) => {
        if (row.tempId !== tempId) return row;
        return {
          ...row,
          productId,
          productName: prod?.name,
          unitsPerPack: prod?.unitsPerPack || prod?.pack_size || 1,
          unitCost: prod?.purchase_price || 0,
          salePrice: prod?.sale_price || 0,
        };
      })
    );
  };

  const handleRowChange = (tempId: string, field: keyof ItemRowDraft, value: string | number) => {
    setItemRows((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    );
  };

  const addRow = () => {
    setItemRows((prev) => [
      ...prev,
      {
        tempId: `row-${Date.now()}-${Math.random()}`,
        productId: "",
        batchNumber: "",
        expiryDate: "",
        quantityPacks: 1,
        unitsPerPack: 1,
        unitCost: 0,
        salePrice: 0,
      },
    ]);
  };

  const removeRow = (tempId: string) => {
    if (itemRows.length <= 1) {
      showToast("Invoice must contain at least one line item", "error");
      return;
    }
    setItemRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleCreateInvoice = async () => {
    if (!invoiceHeader.distributorId) {
      showToast("Please choose a distributor", "error");
      return;
    }
    if (!invoiceHeader.invoiceNumber.trim()) {
      showToast("Please enter an invoice number", "error");
      return;
    }
    for (let i = 0; i < itemRows.length; i++) {
      const row = itemRows[i];
      if (!row.productId) {
        showToast(`Line ${i + 1}: Select a medicine product`, "error");
        return;
      }
      if (!row.batchNumber.trim()) {
        showToast(`Line ${i + 1}: Enter a batch number`, "error");
        return;
      }
      if (!row.expiryDate) {
        showToast(`Line ${i + 1}: Specify expiry date`, "error");
        return;
      }
      if (row.quantityPacks <= 0) {
        showToast(`Line ${i + 1}: Quantity must be at least 1 pack`, "error");
        return;
      }
    }

    setSubmittingInvoice(true);
    try {
      const payload: CreatePurchaseInvoiceInput = {
        distributorId: invoiceHeader.distributorId,
        invoiceNumber: invoiceHeader.invoiceNumber.trim(),
        invoiceDate: invoiceHeader.invoiceDate,
        dueDate: invoiceHeader.dueDate || null,
        discount: invoiceHeader.discount || 0,
        tax: invoiceHeader.tax || 0,
        paidAmount: invoiceHeader.paidAmount || 0,
        paymentMethod: invoiceHeader.paymentMethod,
        notes: invoiceHeader.notes,
        items: itemRows.map((r) => ({
          productId: r.productId,
          batchNumber: r.batchNumber.trim(),
          expiryDate: r.expiryDate,
          quantityPacks: Number(r.quantityPacks),
          unitsPerPack: Number(r.unitsPerPack || 1),
          unitCost: Number(r.unitCost || 0),
          salePrice: Number(r.salePrice || 0),
        })),
      };

      const res = await api.purchaseInvoices.create(payload);
      showToast(`Invoice #${res.invoiceNumber} recorded and stock received!`, "success");
      setCreateModalOpen(false);
      loadData(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to post invoice", "error");
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payInvoice || paymentForm.amount <= 0) {
      showToast("Please enter a valid payment amount", "error");
      return;
    }
    setSubmittingPayment(true);
    try {
      await api.purchaseInvoices.recordPayment(payInvoice.distributorId, {
        ...paymentForm,
        invoiceId: payInvoice.id,
      });
      showToast(`Payment of ${formatCurrency(paymentForm.amount)} recorded!`, "success");
      setPayInvoice(null);
      loadData(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to record payment", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-20 right-8 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2",
              toastMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
            )}
          >
            {toastMessage.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Receipt className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Purchasing & Direct Invoices</h1>
            </div>
            <p className="text-xs text-text-secondary mt-1 ml-11">
              Direct supplier invoice receiving, FEFO batch allocation, and Accounts Payable ledger
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-border bg-surface hover:bg-surface-2 text-text-secondary transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin text-accent")} />
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs shadow-md transition-all"
            >
              <Plus className="h-4 w-4" />
              Receive Supplier Invoice
            </button>
          </div>
        </div>

        {/* Top Financial KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-surface/70 border border-border backdrop-blur-sm">
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Purchases</span>
              <Receipt className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold font-mono text-text-primary">{formatCurrency(totalInvoiced)}</div>
            <div className="text-[11px] text-text-secondary mt-1">{invoices.length} invoices delivered</div>
          </div>

          <div className={cn("p-5 rounded-2xl border backdrop-blur-sm", totalOutstanding > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-surface/70 border-border")}>
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Outstanding (AP)</span>
              <AlertTriangle className={cn("h-4 w-4", totalOutstanding > 0 ? "text-amber-500" : "text-emerald-500")} />
            </div>
            <div className={cn("text-2xl font-bold font-mono", totalOutstanding > 0 ? "text-amber-500" : "text-emerald-500")}>
              {formatCurrency(totalOutstanding)}
            </div>
            <div className="text-[11px] text-text-secondary mt-1">{unpaidCount} invoices pending payment</div>
          </div>

          <div className="p-5 rounded-2xl bg-surface/70 border border-border backdrop-blur-sm">
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Settled Invoices</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-500">{paidCount}</div>
            <div className="text-[11px] text-text-secondary mt-1">Paid in full</div>
          </div>

          <div className="p-5 rounded-2xl bg-surface/70 border border-border backdrop-blur-sm">
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Distributors</span>
              <Building2 className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold font-mono text-text-primary">{distributors.length}</div>
            <div className="text-[11px] text-text-secondary mt-1">Authorized suppliers</div>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface/70 p-3 rounded-2xl border border-border">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search by invoice number or distributor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border text-xs">
            {["ALL", "UNPAID", "PARTIAL", "PAID"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors",
                  statusFilter === st ? "bg-accent text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
                )}
              >
                {st === "ALL" ? "All Invoices" : st}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="rounded-2xl border border-border overflow-hidden bg-surface/70 backdrop-blur-sm shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-text-secondary text-xs">Loading purchase invoices...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-text-secondary text-xs">
              No purchase invoices found. Click &quot;Receive Supplier Invoice&quot; to record a delivery.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-2/60 text-text-secondary uppercase text-[10px] tracking-wider border-b border-border font-medium">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Distributor</th>
                    <th className="py-3 px-3 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Total Billed</th>
                    <th className="py-3 px-4 text-right">Paid Amount</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-accent">
                        #{inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 font-mono text-text-secondary">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-text-primary">{inv.distributorName || "—"}</div>
                        {inv.distributorPhone && (
                          <div className="text-[11px] font-mono text-text-secondary">{inv.distributorPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border font-mono text-[11px]">
                          {inv.items?.length ?? 0} lines
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-emerald-500">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        <span className={inv.balanceDue > 0 ? "text-amber-500 font-bold" : "text-text-secondary"}>
                          {formatCurrency(inv.balanceDue)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-semibold border",
                            inv.status === "PAID"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : inv.status === "PARTIAL"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-2 text-text-secondary hover:text-text-primary text-[11px] transition-colors"
                          >
                            Details
                          </button>
                          {inv.balanceDue > 0 && (
                            <button
                              onClick={() => {
                                setPayInvoice(inv);
                                setPaymentForm({
                                  amount: inv.balanceDue,
                                  paymentMethod: "CASH",
                                  referenceNumber: `PAY-INV-${inv.invoiceNumber}`,
                                  notes: `Payment for Invoice #${inv.invoiceNumber}`,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] transition-colors flex items-center gap-1"
                            >
                              <CreditCard className="h-3 w-3" />
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const dist = distributors.find((d) => d.id === inv.distributorId);
                              if (dist) openDistributorLedger(dist);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/10 text-accent text-[11px] transition-colors"
                            title="View Supplier Statement"
                          >
                            Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* =========================================================================
          DIRECT SUPPLIER INVOICE ENTRY MODAL
          ========================================================================= */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/40">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-text-primary">Receive Direct Supplier Invoice</h3>
                    <p className="text-[11px] text-text-secondary">Capture invoice header, multi-line batches, and auto-provision inventory</p>
                  </div>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-surface-2 text-text-secondary hover:text-text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Header Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-surface-2/50 border border-border">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Distributor *</label>
                    <select
                      className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      value={invoiceHeader.distributorId}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, distributorId: e.target.value })}
                    >
                      <option value="">Select Distributor...</option>
                      {distributors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Invoice Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-9021"
                      value={invoiceHeader.invoiceNumber}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceNumber: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={invoiceHeader.invoiceDate}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceDate: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Payment Method</label>
                    <select
                      className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      value={invoiceHeader.paymentMethod}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, paymentMethod: e.target.value as "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT" })}
                    >
                      <option value="CREDIT">Credit (Pay Later)</option>
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                </div>

                {/* Line Items Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-accent" />
                      Medication Products & Batch Receipt
                    </h4>
                    <button
                      onClick={addRow}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 text-xs font-medium text-text-primary"
                    >
                      <Plus className="h-3.5 w-3.5 text-accent" />
                      Add Line Item
                    </button>
                  </div>

                  <div className="rounded-2xl border border-border overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-surface-2/70 text-text-secondary uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3 min-w-[200px]">Product *</th>
                          <th className="py-2.5 px-2 w-[130px]">Batch # *</th>
                          <th className="py-2.5 px-2 w-[130px]">Expiry *</th>
                          <th className="py-2.5 px-2 w-[80px] text-right">Packs</th>
                          <th className="py-2.5 px-2 w-[70px] text-right">Units/Pk</th>
                          <th className="py-2.5 px-2 w-[95px] text-right">Cost/Pk</th>
                          <th className="py-2.5 px-2 w-[95px] text-right">Sale/Pk</th>
                          <th className="py-2.5 px-2 w-[100px] text-right">Line Total</th>
                          <th className="py-2.5 px-2 w-[35px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-surface-1">
                        {itemRows.map((row) => (
                          <tr key={row.tempId} className="hover:bg-surface-2/30">
                            <td className="p-2">
                              <select
                                className="w-full h-8 px-2 rounded-lg border border-border bg-surface text-xs text-text-primary"
                                value={row.productId}
                                onChange={(e) => handleProductSelect(row.tempId, e.target.value)}
                              >
                                <option value="">Select product...</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.barcode || "No Barcode"})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="Batch #"
                                value={row.batchNumber}
                                onChange={(e) => handleRowChange(row.tempId, "batchNumber", e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-surface font-mono text-xs text-text-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="date"
                                value={row.expiryDate}
                                onChange={(e) => handleRowChange(row.tempId, "expiryDate", e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-surface font-mono text-xs text-text-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={row.quantityPacks}
                                onChange={(e) => handleRowChange(row.tempId, "quantityPacks", Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-surface font-mono text-xs text-right text-text-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={row.unitsPerPack}
                                onChange={(e) => handleRowChange(row.tempId, "unitsPerPack", Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-surface font-mono text-xs text-right text-text-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.unitCost}
                                onChange={(e) => handleRowChange(row.tempId, "unitCost", parseFloat(e.target.value) || 0)}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-surface font-mono text-xs text-right text-text-primary"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.salePrice}
                                onChange={(e) => handleRowChange(row.tempId, "salePrice", parseFloat(e.target.value) || 0)}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-surface font-mono text-xs text-right text-text-primary"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-text-primary">
                              {formatCurrency(row.quantityPacks * (row.unitCost || 0))}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => removeRow(row.tempId)}
                                className="text-text-secondary hover:text-danger p-1 rounded transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">Invoice Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Delivered by distributor agent; cold-chain verified"
                        value={invoiceHeader.notes}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, notes: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div className="p-3 bg-surface-2/60 rounded-xl border border-border text-xs text-text-secondary space-y-1">
                      <div className="font-semibold text-text-primary flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        FEFO Inventory Assurance
                      </div>
                      <div>• Batches are created or topped up with earliest expiry tracking.</div>
                      <div>• Automatically increments store stock and writes to the movement ledger.</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface-2/60 border border-border space-y-2 text-xs">
                    <div className="flex justify-between text-text-secondary">
                      <span>Subtotal:</span>
                      <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-text-secondary">Discount:</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={invoiceHeader.discount || ""}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, discount: parseFloat(e.target.value) || 0 })}
                        className="h-7 w-24 px-2 rounded-lg border border-border bg-surface text-right font-mono text-xs"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-text-secondary">Tax / VAT:</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={invoiceHeader.tax || ""}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, tax: parseFloat(e.target.value) || 0 })}
                        className="h-7 w-24 px-2 rounded-lg border border-border bg-surface text-right font-mono text-xs"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex justify-between text-sm font-bold text-text-primary pt-2 border-t border-border">
                      <span>Grand Total:</span>
                      <span className="font-mono">{formatCurrency(grandTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <span className="text-text-secondary">Amount Paid Upfront:</span>
                      <input
                        type="number"
                        min="0"
                        max={grandTotal}
                        step="any"
                        value={invoiceHeader.paidAmount || ""}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, paidAmount: parseFloat(e.target.value) || 0 })}
                        className="h-7 w-24 px-2 rounded-lg border border-border bg-surface text-right font-mono text-xs text-emerald-500 font-bold"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t border-border">
                      <span className="text-text-secondary">Remaining Accounts Payable:</span>
                      <span className={cn("font-mono", remainingDue > 0 ? "text-amber-500 font-bold" : "text-emerald-500")}>
                        {formatCurrency(remainingDue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border bg-surface-2/40 flex items-center justify-between">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-2 text-xs font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  disabled={submittingInvoice}
                  onClick={handleCreateInvoice}
                  className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  {submittingInvoice ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Receiving Inventory...
                    </>
                  ) : (
                    `Post Invoice & Receive Stock (${formatCurrency(grandTotal)})`
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          INVOICE DETAIL MODAL
          ========================================================================= */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/40">
                <div className="flex items-center gap-2.5">
                  <Receipt className="h-5 w-5 text-accent" />
                  <h3 className="font-bold text-base text-text-primary">
                    Purchase Invoice #{selectedInvoice.invoiceNumber}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 rounded-lg hover:bg-surface-2 text-text-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-surface-2/60 rounded-xl text-xs">
                  <div>
                    <span className="text-text-secondary">Distributor:</span>
                    <p className="font-semibold text-text-primary text-sm mt-0.5">{selectedInvoice.distributorName}</p>
                  </div>
                  <div>
                    <span className="text-text-secondary">Date:</span>
                    <p className="font-mono text-text-primary mt-0.5">{formatDate(selectedInvoice.invoiceDate)}</p>
                  </div>
                  <div>
                    <span className="text-text-secondary">Payment Method:</span>
                    <p className="font-medium text-text-primary mt-0.5">{selectedInvoice.paymentMethod}</p>
                  </div>
                  <div>
                    <span className="text-text-secondary">Status:</span>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedInvoice.status}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Itemized Batches</h4>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-surface-2 text-text-secondary border-b border-border">
                        <tr>
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3 font-mono">Batch #</th>
                          <th className="py-2 px-3 font-mono">Expiry</th>
                          <th className="py-2 px-3 text-right">Packs</th>
                          <th className="py-2 px-3 text-right">Cost/Pk</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedInvoice.items?.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-2/40">
                            <td className="py-2 px-3 font-medium text-text-primary">{item.productName}</td>
                            <td className="py-2 px-3 font-mono text-text-secondary">{item.batchNumber}</td>
                            <td className="py-2 px-3 font-mono text-text-secondary">{formatDate(item.expiryDate)}</td>
                            <td className="py-2 px-3 text-right font-mono">{item.quantityPacks}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.unitCost)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-text-primary">
                              {formatCurrency(item.totalCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-3 bg-surface-2/60 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="text-text-secondary">Total Billed: </span>
                    <span className="font-mono font-bold text-text-primary">{formatCurrency(selectedInvoice.totalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Paid: </span>
                    <span className="font-mono font-bold text-emerald-500">{formatCurrency(selectedInvoice.paidAmount)}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Remaining Balance: </span>
                    <span className={cn("font-mono font-bold", selectedInvoice.balanceDue > 0 ? "text-amber-500" : "text-emerald-500")}>
                      {formatCurrency(selectedInvoice.balanceDue)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          DISTRIBUTOR LEDGER DRAWER
          ========================================================================= */}
      <AnimatePresence>
        {ledgerDistributor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/40">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-5 w-5 text-accent" />
                  <div>
                    <h3 className="font-bold text-base text-text-primary">
                      {ledgerDistributor.name} — Accounts Payable Statement
                    </h3>
                    <p className="text-[11px] text-text-secondary">
                      Contact: {ledgerDistributor.phone} {ledgerData?.distributor?.companyName ? `• ${ledgerData.distributor.companyName}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLedgerDistributor(null)}
                  className="p-1 rounded-lg hover:bg-surface-2 text-text-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loadingLedger ? (
                  <div className="text-center py-16 text-text-secondary text-xs">Loading ledger transactions...</div>
                ) : ledgerData ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-surface-2/50 border border-border">
                        <span className="text-[11px] font-semibold uppercase text-text-secondary">Total Invoiced</span>
                        <div className="text-xl font-bold font-mono text-text-primary mt-1">
                          {formatCurrency(ledgerData.summary.totalInvoiced)}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-2/50 border border-border">
                        <span className="text-[11px] font-semibold uppercase text-text-secondary">Total Paid</span>
                        <div className="text-xl font-bold font-mono text-emerald-500 mt-1">
                          {formatCurrency(ledgerData.summary.totalPaid)}
                        </div>
                      </div>
                      <div className={cn("p-4 rounded-xl border", ledgerData.summary.outstandingBalance > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30")}>
                        <span className="text-[11px] font-semibold uppercase text-text-secondary">Balance Owed (AP)</span>
                        <div className={cn("text-xl font-bold font-mono mt-1", ledgerData.summary.outstandingBalance > 0 ? "text-amber-500" : "text-emerald-500")}>
                          {formatCurrency(ledgerData.summary.outstandingBalance)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Chronological Statement Timeline</h4>
                      {ledgerData.statement.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border rounded-xl text-text-secondary text-xs">
                          No transactions recorded for this distributor yet.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-surface-2 text-text-secondary uppercase text-[10px] tracking-wider border-b border-border">
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
                                <tr key={entry.id} className="hover:bg-surface-2/40">
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
                                  <td className="py-2.5 px-3 text-text-primary font-medium">{entry.description}</td>
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
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          RECORD PAYMENT MODAL
          ========================================================================= */}
      <AnimatePresence>
        {payInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                  <h3 className="font-bold text-base text-text-primary">Pay Supplier Invoice</h3>
                </div>
                <button onClick={() => setPayInvoice(null)} className="p-1 rounded-lg hover:bg-surface-2 text-text-secondary">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-surface-2/60 border border-border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Invoice #:</span>
                  <span className="font-mono font-bold text-accent">#{payInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Distributor:</span>
                  <span className="font-semibold text-text-primary">{payInvoice.distributorName}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-bold text-amber-500">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatCurrency(payInvoice.balanceDue)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Payment Amount</label>
                <input
                  type="number"
                  min="0.01"
                  max={payInvoice.balanceDue}
                  step="any"
                  value={paymentForm.amount || ""}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 font-mono text-xs text-text-primary"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Payment Method</label>
                <select
                  className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 text-xs text-text-primary"
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as "CASH" | "BANK_TRANSFER" | "CHEQUE" })}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Reference Number</label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber || ""}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 text-xs font-mono text-text-primary"
                  placeholder="e.g. TXN-81920"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes || ""}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-surface-1 text-xs text-text-primary"
                  placeholder="Payment notes..."
                />
              </div>

              <button
                disabled={submittingPayment || paymentForm.amount <= 0}
                onClick={handleRecordPayment}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                {submittingPayment ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  `Confirm Payment of ${formatCurrency(paymentForm.amount)}`
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
