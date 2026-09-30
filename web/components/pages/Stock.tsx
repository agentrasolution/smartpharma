"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, RotateCcw, Eye, EyeOff, Barcode, Search,
  FileText, Receipt, CreditCard, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, DollarSign, Calendar, Package, Layers, X, ShieldAlert,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type {
  StockPurchase, Product, Company, Distributor,
  PurchaseInvoice, PurchaseInvoiceItemInput, CreatePurchaseInvoiceInput,
  RecordSupplierPaymentInput,
} from "@/types";

interface InvoiceItemDraft extends PurchaseInvoiceItemInput {
  tempId: string;
  productName?: string;
  defaultUnitsPerPack?: number;
}

export default function Stock() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"invoices" | "legacy">("invoices");

  // Filter & Search states
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("ALL");

  // New Invoice Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
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

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemDraft[]>([
    {
      tempId: "item-1",
      productId: "",
      batchNumber: "",
      expiryDate: "",
      quantityPacks: 1,
      unitsPerPack: 1,
      unitCost: 0,
      salePrice: 0,
    },
  ]);

  // Invoice Details & Payment Modal
  const [viewInvoice, setViewInvoice] = useState<PurchaseInvoice | null>(null);
  const [payInvoiceModal, setPayInvoiceModal] = useState<PurchaseInvoice | null>(null);
  const [paymentForm, setPaymentForm] = useState<RecordSupplierPaymentInput>({
    amount: 0,
    paymentMethod: "CASH",
    referenceNumber: "",
    notes: "",
  });

  // Legacy Stock Purchase states
  const [openLegacy, setOpenLegacy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [legacySearch, setLegacySearch] = useState("");
  const [legacyForm, setLegacyForm] = useState({
    productId: "", distributorId: "", companyId: "",
    invoiceNumber: "", packs: "1", quantity: "", expiry: "",
  });
  const [qtyLocked, setQtyLocked] = useState(true);

  // Queries
  const { data: purchaseInvoices = [], isLoading: invoicesLoading } = useQuery<PurchaseInvoice[]>({
    queryKey: ["purchaseInvoices"],
    queryFn: () => api.purchaseInvoices.list(),
  });

  const { data: stockEntries = [], isLoading: stockLoading } = useQuery({
    queryKey: ["stock"],
    queryFn: api.stock.list,
  });

  const { data: productList = { data: [] as Product[] } } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.list({ pageSize: 1000 }),
  });
  const products = productList.data;

  const { data: distributors = [] } = useQuery({
    queryKey: ["distributors"],
    queryFn: api.distributors.list,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: api.companies.list,
  });

  // Calculate Invoice Modal Live Totals
  const subtotal = invoiceItems.reduce((acc, item) => acc + (item.quantityPacks * (item.unitCost || 0)), 0);
  const grandTotal = Math.max(0, subtotal - (invoiceHeader.discount || 0) + (invoiceHeader.tax || 0));
  const remainingDue = Math.max(0, grandTotal - (invoiceHeader.paidAmount || 0));

  // Invoices summary metrics
  const totalInvoicedAmount = purchaseInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalOutstandingAP = purchaseInvoices.reduce((acc, inv) => acc + inv.balanceDue, 0);
  const unpaidInvoicesCount = purchaseInvoices.filter((inv) => inv.status !== "PAID" && inv.status !== "VOID").length;
  const paidInvoicesCount = purchaseInvoices.filter((inv) => inv.status === "PAID").length;

  // Filtered Invoices
  const filteredInvoices = purchaseInvoices.filter((inv) => {
    const matchesSearch = !invoiceSearch ||
      inv.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      (inv.distributorName && inv.distributorName.toLowerCase().includes(invoiceSearch.toLowerCase()));
    const matchesStatus = invoiceStatusFilter === "ALL" || inv.status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: (payload: CreatePurchaseInvoiceInput) => api.purchaseInvoices.create(payload),
    onSuccess: (res) => {
      toast.success(`Purchase Invoice #${res.invoiceNumber} recorded & inventory updated!`);
      queryClient.invalidateQueries({ queryKey: ["purchaseInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["distributors"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setInvoiceModalOpen(false);
      resetInvoiceForm();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record purchase invoice");
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: () => {
      if (!payInvoiceModal) throw new Error("No invoice selected");
      return api.purchaseInvoices.recordPayment(payInvoiceModal.distributorId, {
        ...paymentForm,
        invoiceId: payInvoiceModal.id,
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["purchaseInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["distributors"] });
      setPayInvoiceModal(null);
      if (viewInvoice) {
        // Refresh detail view if open
        api.purchaseInvoices.getById(viewInvoice.id).then(setViewInvoice).catch(() => {});
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Legacy Mutations
  const legacyCreateMutation = useMutation({
    mutationFn: () => api.stock.create({
      productId: legacyForm.productId,
      distributorId: legacyForm.distributorId || undefined,
      companyId: legacyForm.companyId || undefined,
      invoiceNumber: legacyForm.invoiceNumber,
      quantity: Number(legacyForm.quantity),
      expiry: legacyForm.expiry || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpenLegacy(false);
      setLegacyForm({ productId: "", distributorId: "", companyId: "", invoiceNumber: "", packs: "1", quantity: "", expiry: "" });
      toast.success("Stock purchase recorded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const legacyDeleteMutation = useMutation({
    mutationFn: (id: string) => api.stock.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock entry deleted");
      setDeleteId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  function resetInvoiceForm() {
    setInvoiceHeader({
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
    setInvoiceItems([
      {
        tempId: `item-${Date.now()}`,
        productId: "",
        batchNumber: "",
        expiryDate: "",
        quantityPacks: 1,
        unitsPerPack: 1,
        unitCost: 0,
        salePrice: 0,
      },
    ]);
  }

  function handleProductSelect(tempId: string, productId: string) {
    const prod = products.find((p) => p.id === productId);
    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.tempId !== tempId) return item;
        return {
          ...item,
          productId,
          productName: prod?.name,
          unitsPerPack: prod?.unitsPerPack || prod?.pack_size || 1,
          unitCost: prod?.purchase_price || 0,
          salePrice: prod?.sale_price || 0,
        };
      })
    );
  }

  function handleItemChange(tempId: string, field: keyof InvoiceItemDraft, value: any) {
    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.tempId !== tempId) return item;
        return { ...item, [field]: value };
      })
    );
  }

  function addItemRow() {
    setInvoiceItems((prev) => [
      ...prev,
      {
        tempId: `item-${Date.now()}-${Math.random()}`,
        productId: "",
        batchNumber: "",
        expiryDate: "",
        quantityPacks: 1,
        unitsPerPack: 1,
        unitCost: 0,
        salePrice: 0,
      },
    ]);
  }

  function removeItemRow(tempId: string) {
    if (invoiceItems.length <= 1) {
      toast.error("An invoice must contain at least one line item");
      return;
    }
    setInvoiceItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }

  function submitInvoice() {
    if (!invoiceHeader.distributorId) {
      toast.error("Please select a distributor");
      return;
    }
    if (!invoiceHeader.invoiceNumber.trim()) {
      toast.error("Please enter the distributor invoice number");
      return;
    }
    for (let i = 0; i < invoiceItems.length; i++) {
      const item = invoiceItems[i];
      if (!item.productId) {
        toast.error(`Please select a product for line ${i + 1}`);
        return;
      }
      if (!item.batchNumber.trim()) {
        toast.error(`Please enter a batch number for line ${i + 1}`);
        return;
      }
      if (!item.expiryDate) {
        toast.error(`Please enter an expiry date for line ${i + 1}`);
        return;
      }
      if (item.quantityPacks <= 0) {
        toast.error(`Quantity packs must be greater than zero on line ${i + 1}`);
        return;
      }
    }

    const payload: CreatePurchaseInvoiceInput = {
      distributorId: invoiceHeader.distributorId,
      invoiceNumber: invoiceHeader.invoiceNumber.trim(),
      invoiceDate: invoiceHeader.invoiceDate || undefined,
      dueDate: invoiceHeader.dueDate || null,
      discount: invoiceHeader.discount || 0,
      tax: invoiceHeader.tax || 0,
      paidAmount: invoiceHeader.paidAmount || 0,
      paymentMethod: invoiceHeader.paymentMethod,
      notes: invoiceHeader.notes,
      items: invoiceItems.map((i) => ({
        productId: i.productId,
        batchNumber: i.batchNumber.trim(),
        expiryDate: i.expiryDate,
        quantityPacks: Number(i.quantityPacks),
        unitsPerPack: Number(i.unitsPerPack || 1),
        unitCost: Number(i.unitCost || 0),
        salePrice: Number(i.salePrice || 0),
      })),
    };

    createInvoiceMutation.mutate(payload);
  }

  function openPayDialog(inv: PurchaseInvoice) {
    setPayInvoiceModal(inv);
    setPaymentForm({
      amount: inv.balanceDue,
      paymentMethod: "CASH",
      referenceNumber: `PAY-INV-${inv.invoiceNumber}`,
      notes: `Settlement for Invoice #${inv.invoiceNumber}`,
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Purchasing & Supplier Invoices"
        description="Direct supplier invoice entry, batch receiving, and Accounts Payable tracking"
        action={{
          label: "Receive Supplier Invoice",
          onClick: () => {
            resetInvoiceForm();
            setInvoiceModalOpen(true);
          },
        }}
      />

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("invoices")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === "invoices"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
          )}
        >
          <Receipt className="h-4 w-4" />
          Direct Supplier Invoices ({purchaseInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab("legacy")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === "legacy"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
          )}
        >
          <Layers className="h-4 w-4" />
          Legacy Stock Log ({stockEntries.length})
        </button>
      </div>

      {activeTab === "invoices" ? (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-surface-1 border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-text-secondary mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Invoiced</span>
                  <Receipt className="h-4 w-4 text-accent" />
                </div>
                <div className="text-2xl font-bold font-mono text-text-primary">{formatCurrency(totalInvoicedAmount)}</div>
                <p className="text-[11px] text-text-secondary mt-1">{purchaseInvoices.length} invoices recorded</p>
              </CardContent>
            </Card>

            <Card className={cn("border", totalOutstandingAP > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-surface-1 border-border")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-text-secondary mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Outstanding (AP)</span>
                  <AlertTriangle className={cn("h-4 w-4", totalOutstandingAP > 0 ? "text-amber-500" : "text-emerald-500")} />
                </div>
                <div className={cn("text-2xl font-bold font-mono", totalOutstandingAP > 0 ? "text-amber-500" : "text-emerald-500")}>
                  {formatCurrency(totalOutstandingAP)}
                </div>
                <p className="text-[11px] text-text-secondary mt-1">{unpaidInvoicesCount} invoices pending payment</p>
              </CardContent>
            </Card>

            <Card className="bg-surface-1 border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-text-secondary mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Settled Invoices</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-500">{paidInvoicesCount}</div>
                <p className="text-[11px] text-text-secondary mt-1">Fully paid to distributors</p>
              </CardContent>
            </Card>

            <Card className="bg-surface-1 border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-text-secondary mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Active Suppliers</span>
                  <Layers className="h-4 w-4 text-accent" />
                </div>
                <div className="text-2xl font-bold font-mono text-text-primary">{distributors.length}</div>
                <p className="text-[11px] text-text-secondary mt-1">Verified distributors</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <Input
                placeholder="Search by invoice number or distributor..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-lg border border-border text-xs">
              {["ALL", "UNPAID", "PARTIAL", "PAID"].map((st) => (
                <button
                  key={st}
                  onClick={() => setInvoiceStatusFilter(st)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-colors",
                    invoiceStatusFilter === st
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {st === "ALL" ? "All Invoices" : st}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices Data Table */}
          <div className="rounded-xl border border-border overflow-hidden bg-surface-1">
            <DataTable
              loading={invoicesLoading}
              data={filteredInvoices}
              keyExtractor={(inv) => inv.id}
              emptyMessage="No purchase invoices recorded yet. Click 'Receive Supplier Invoice' to record direct delivery."
              columns={[
                {
                  key: "invoiceNumber",
                  header: "Invoice #",
                  cell: (inv) => (
                    <button
                      onClick={() => setViewInvoice(inv)}
                      className="font-mono font-semibold text-accent hover:underline text-left"
                    >
                      #{inv.invoiceNumber}
                    </button>
                  ),
                },
                {
                  key: "invoiceDate",
                  header: "Date",
                  cell: (inv) => <span className="font-mono text-xs text-text-secondary">{formatDate(inv.invoiceDate)}</span>,
                },
                {
                  key: "distributorName",
                  header: "Distributor",
                  cell: (inv) => (
                    <div>
                      <div className="font-medium text-text-primary">{inv.distributorName || "—"}</div>
                      {inv.distributorPhone && <div className="text-[11px] font-mono text-text-secondary">{inv.distributorPhone}</div>}
                    </div>
                  ),
                },
                {
                  key: "itemsCount",
                  header: "Items",
                  cell: (inv) => (
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-primary border border-border">
                      {inv.items?.length ?? 0} lines
                    </span>
                  ),
                },
                {
                  key: "totalAmount",
                  header: "Total Billed",
                  cell: (inv) => <span className="font-mono font-bold text-text-primary">{formatCurrency(inv.totalAmount)}</span>,
                },
                {
                  key: "paidAmount",
                  header: "Paid",
                  cell: (inv) => <span className="font-mono text-emerald-500 font-medium">{formatCurrency(inv.paidAmount)}</span>,
                },
                {
                  key: "balanceDue",
                  header: "Balance Due",
                  cell: (inv) => (
                    <span className={cn("font-mono font-semibold", inv.balanceDue > 0 ? "text-amber-500" : "text-text-secondary")}>
                      {formatCurrency(inv.balanceDue)}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (inv) => {
                    const colors = {
                      PAID: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                      PARTIAL: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                      UNPAID: "bg-rose-500/10 text-rose-500 border-rose-500/20",
                      VOID: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                    }[inv.status] || "bg-surface-2 text-text-secondary";
                    return (
                      <span className={cn("px-2 py-0.5 rounded text-[11px] font-semibold border", colors)}>
                        {inv.status}
                      </span>
                    );
                  },
                },
                {
                  key: "actions",
                  header: "",
                  cell: (inv) => (
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setViewInvoice(inv)} className="h-7 px-2 text-xs">
                        Details
                      </Button>
                      {inv.balanceDue > 0 && (
                        <Button
                          size="sm"
                          onClick={() => openPayDialog(inv)}
                          className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1"
                        >
                          <CreditCard className="h-3 w-3" />
                          Pay
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </>
      ) : (
        /* Legacy Stock Purchases View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <Input
                placeholder="Search legacy stock..."
                value={legacySearch}
                onChange={(e) => setLegacySearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setOpenLegacy(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Single Stock Item
            </Button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-surface-1">
            <DataTable
              loading={stockLoading}
              data={stockEntries.filter((s: StockPurchase) =>
                !legacySearch ||
                (s.product_name && s.product_name.toLowerCase().includes(legacySearch.toLowerCase())) ||
                (s.invoice_number && s.invoice_number.toLowerCase().includes(legacySearch.toLowerCase()))
              )}
              keyExtractor={(s: StockPurchase) => s.id}
              emptyMessage="No legacy stock entries found"
              columns={[
                { key: "product_name", header: "Product", cell: (s) => <span className="font-medium text-text-primary">{s.product_name}</span> },
                { key: "distributor_name", header: "Distributor", cell: (s) => <span>{s.distributor_name || "—"}</span> },
                { key: "invoice_number", header: "Invoice #", cell: (s) => <span className="font-mono text-xs">{s.invoice_number || "—"}</span> },
                { key: "quantity", header: "Packs", cell: (s) => <span className="font-mono font-semibold">{s.quantity}</span> },
                { key: "purchase_price", header: "Cost Price", cell: (s) => <span className="font-mono">{formatCurrency(s.purchase_price)}</span> },
                { key: "total_value", header: "Total Value", cell: (s) => <span className="font-mono font-bold">{formatCurrency(s.total_value)}</span> },
                { key: "expiry", header: "Expiry", cell: (s) => <span className="font-mono text-xs text-text-secondary">{formatDate(s.expiry)}</span> },
                {
                  key: "actions",
                  header: "",
                  cell: (s) => (
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setDeleteId(s.id)}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          DIRECT SUPPLIER INVOICE ENTRY MODAL (Header + Multi-Line Items)
          ========================================================================= */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              Receive Direct Supplier Invoice
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Invoice Header Section */}
            <div className="p-4 rounded-xl bg-surface-2 border border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Distributor *</Label>
                <SearchableSelect
                  options={distributors.map((d: Distributor) => ({ value: d.id, label: d.name }))}
                  value={invoiceHeader.distributorId}
                  onChange={(v) => setInvoiceHeader({ ...invoiceHeader, distributorId: v })}
                  placeholder="Select distributor..."
                />
              </div>

              <div>
                <Label className="text-xs">Invoice Number *</Label>
                <Input
                  placeholder="e.g. INV-2026-8491"
                  value={invoiceHeader.invoiceNumber}
                  onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceNumber: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceHeader.invoiceDate}
                  onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceDate: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">Payment Method</Label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface-1 text-sm text-text-primary"
                  value={invoiceHeader.paymentMethod}
                  onChange={(e) => setInvoiceHeader({ ...invoiceHeader, paymentMethod: e.target.value as any })}
                >
                  <option value="CREDIT">Credit (Pay Later)</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Package className="h-4 w-4 text-accent" />
                  Delivered Medication Items & Batches
                </h4>
                <Button size="sm" variant="outline" onClick={addItemRow} className="gap-1.5 text-xs h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Add Line Item
                </Button>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-2 text-text-secondary border-b border-border font-medium">
                    <tr>
                      <th className="py-2.5 px-3 min-w-[200px]">Product *</th>
                      <th className="py-2.5 px-2 w-[130px]">Batch # *</th>
                      <th className="py-2.5 px-2 w-[130px]">Expiry *</th>
                      <th className="py-2.5 px-2 w-[85px] text-right">Packs</th>
                      <th className="py-2.5 px-2 w-[70px] text-right">Units/Pk</th>
                      <th className="py-2.5 px-2 w-[100px] text-right">Cost/Pk</th>
                      <th className="py-2.5 px-2 w-[100px] text-right">Sale/Pk</th>
                      <th className="py-2.5 px-2 w-[110px] text-right">Line Total</th>
                      <th className="py-2.5 px-2 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-1">
                    {invoiceItems.map((item, index) => (
                      <tr key={item.tempId} className="hover:bg-surface-2/30">
                        <td className="p-2">
                          <SearchableSelect
                            options={products.map((p) => ({
                              value: p.id,
                              label: `${p.name} (${p.barcode || "No Barcode"})`,
                            }))}
                            value={item.productId}
                            onChange={(val) => handleProductSelect(item.tempId, val)}
                            placeholder="Select product..."
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder="Batch #"
                            value={item.batchNumber}
                            onChange={(e) => handleItemChange(item.tempId, "batchNumber", e.target.value)}
                            className="h-9 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) => handleItemChange(item.tempId, "expiryDate", e.target.value)}
                            className="h-9 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantityPacks}
                            onChange={(e) => handleItemChange(item.tempId, "quantityPacks", Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-9 font-mono text-xs text-right"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.unitsPerPack}
                            onChange={(e) => handleItemChange(item.tempId, "unitsPerPack", Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-9 font-mono text-xs text-right"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitCost}
                            onChange={(e) => handleItemChange(item.tempId, "unitCost", parseFloat(e.target.value) || 0)}
                            className="h-9 font-mono text-xs text-right"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.salePrice}
                            onChange={(e) => handleItemChange(item.tempId, "salePrice", parseFloat(e.target.value) || 0)}
                            className="h-9 font-mono text-xs text-right"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-text-primary">
                          {formatCurrency(item.quantityPacks * (item.unitCost || 0))}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(item.tempId)}
                            className="text-text-secondary hover:text-danger p-1 rounded"
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

            {/* Calculations & Payment Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Invoice Notes</Label>
                  <Input
                    placeholder="e.g. Received via delivery truck #4; inspected by pharmacist"
                    value={invoiceHeader.notes}
                    onChange={(e) => setInvoiceHeader({ ...invoiceHeader, notes: e.target.value })}
                  />
                </div>
                <div className="p-3 bg-surface-2 rounded-lg border border-border text-xs text-text-secondary space-y-1">
                  <div className="font-semibold text-text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Automated Inventory Allocation
                  </div>
                  <div>• Batches are automatically provisioned or topped up with FEFO expiry tracking.</div>
                  <div>• Immutable stock receipts logged to the stock movements audit ledger.</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-2 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-text-secondary">Discount:</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={invoiceHeader.discount || ""}
                    onChange={(e) => setInvoiceHeader({ ...invoiceHeader, discount: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-28 text-right font-mono text-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-text-secondary">Tax:</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={invoiceHeader.tax || ""}
                    onChange={(e) => setInvoiceHeader({ ...invoiceHeader, tax: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-28 text-right font-mono text-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between text-base font-bold text-text-primary pt-2 border-t border-border">
                  <span>Grand Total:</span>
                  <span className="font-mono">{formatCurrency(grandTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 pt-1">
                  <span className="text-text-secondary text-xs">Amount Paid Upfront:</span>
                  <Input
                    type="number"
                    min="0"
                    max={grandTotal}
                    step="any"
                    value={invoiceHeader.paidAmount || ""}
                    onChange={(e) => setInvoiceHeader({ ...invoiceHeader, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-28 text-right font-mono text-xs text-emerald-500 font-bold"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-border">
                  <span className="text-text-secondary">Remaining Accounts Payable:</span>
                  <span className={cn("font-mono", remainingDue > 0 ? "text-amber-500 font-bold" : "text-emerald-500")}>
                    {formatCurrency(remainingDue)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              className="w-full h-11 text-sm font-semibold bg-accent hover:bg-accent/90"
              disabled={createInvoiceMutation.isPending}
              onClick={submitInvoice}
            >
              {createInvoiceMutation.isPending ? "Posting Invoice & Updating Inventory..." : `Post Invoice & Receive Stock (${formatCurrency(grandTotal)})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          INVOICE DETAIL DIALOG
          ========================================================================= */}
      <Dialog open={!!viewInvoice} onOpenChange={(v) => { if (!v) setViewInvoice(null); }}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-accent" />
                Purchase Invoice #{viewInvoice?.invoiceNumber}
              </DialogTitle>
              {viewInvoice && viewInvoice.balanceDue > 0 && (
                <Button size="sm" onClick={() => openPayDialog(viewInvoice)} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </Button>
              )}
            </div>
          </DialogHeader>

          {viewInvoice && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-surface-2 rounded-xl text-xs">
                <div>
                  <span className="text-text-secondary">Distributor:</span>
                  <p className="font-semibold text-text-primary text-sm mt-0.5">{viewInvoice.distributorName}</p>
                </div>
                <div>
                  <span className="text-text-secondary">Invoice Date:</span>
                  <p className="font-mono text-text-primary mt-0.5">{formatDate(viewInvoice.invoiceDate)}</p>
                </div>
                <div>
                  <span className="text-text-secondary">Payment Method:</span>
                  <p className="font-medium text-text-primary mt-0.5">{viewInvoice.paymentMethod}</p>
                </div>
                <div>
                  <span className="text-text-secondary">Status:</span>
                  <p className="font-semibold text-text-primary mt-0.5">{viewInvoice.status}</p>
                </div>
              </div>

              {/* Line items table */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Line Items & Batches</h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-2 text-text-secondary border-b border-border">
                      <tr>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3 font-mono">Batch #</th>
                        <th className="py-2 px-3 font-mono">Expiry</th>
                        <th className="py-2 px-3 text-right">Packs</th>
                        <th className="py-2 px-3 text-right">Cost/Pk</th>
                        <th className="py-2 px-3 text-right">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {viewInvoice.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-2/40">
                          <td className="py-2 px-3 font-medium text-text-primary">{item.productName}</td>
                          <td className="py-2 px-3 font-mono text-text-secondary">{item.batchNumber}</td>
                          <td className="py-2 px-3 font-mono text-text-secondary">{formatDate(item.expiryDate)}</td>
                          <td className="py-2 px-3 text-right font-mono">{item.quantityPacks}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.unitCost)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-text-primary">{formatCurrency(item.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 bg-surface-2 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-text-secondary">Total Billed: </span>
                  <span className="font-mono font-bold text-text-primary">{formatCurrency(viewInvoice.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-text-secondary">Paid: </span>
                  <span className="font-mono font-bold text-emerald-500">{formatCurrency(viewInvoice.paidAmount)}</span>
                </div>
                <div>
                  <span className="text-text-secondary">Remaining Balance: </span>
                  <span className={cn("font-mono font-bold", viewInvoice.balanceDue > 0 ? "text-amber-500" : "text-emerald-500")}>
                    {formatCurrency(viewInvoice.balanceDue)}
                  </span>
                </div>
              </div>

              {/* Payment History */}
              {viewInvoice.payments && viewInvoice.payments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Payments Applied</h4>
                  <div className="space-y-1.5">
                    {viewInvoice.payments.map((p) => (
                      <div key={p.id} className="flex justify-between items-center p-2 rounded-lg border border-border bg-surface-1 text-xs">
                        <div>
                          <span className="font-medium text-text-primary">{p.paymentMethod}</span>
                          {p.referenceNumber && <span className="font-mono text-text-secondary ml-2">({p.referenceNumber})</span>}
                          {p.notes && <span className="text-text-secondary text-[11px] block">{p.notes}</span>}
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-500">{formatCurrency(p.amount)}</span>
                          <span className="font-mono text-[10px] text-text-secondary block">{formatDate(p.paidAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          RECORD PAYMENT SUB-DIALOG
          ========================================================================= */}
      <Dialog open={!!payInvoiceModal} onOpenChange={(v) => { if (!v) setPayInvoiceModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Pay Supplier Invoice #{payInvoiceModal?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-5 space-y-4">
            <div className="p-3 rounded-lg bg-surface-2 border border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-text-secondary">Distributor:</span>
                <span className="font-medium text-text-primary">{payInvoiceModal?.distributorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Invoice Total:</span>
                <span className="font-mono">{formatCurrency(payInvoiceModal?.totalAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-amber-500 pt-1 border-t border-border">
                <span>Balance Due:</span>
                <span className="font-mono">{formatCurrency(payInvoiceModal?.balanceDue)}</span>
              </div>
            </div>

            <div>
              <Label>Payment Amount</Label>
              <Input
                type="number"
                min="0.01"
                max={payInvoiceModal?.balanceDue}
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
              <Label>Reference Number (Cheque / Transfer #)</Label>
              <Input
                value={paymentForm.referenceNumber || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                placeholder="e.g. TXN-10827"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={paymentForm.notes || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Payment description..."
              />
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={paymentForm.amount <= 0 || recordPaymentMutation.isPending}
              onClick={() => recordPaymentMutation.mutate()}
            >
              {recordPaymentMutation.isPending ? "Recording Payment..." : `Confirm Payment of ${formatCurrency(paymentForm.amount)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Legacy Stock Modal */}
      <Dialog open={openLegacy} onOpenChange={setOpenLegacy}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Single Stock Item (Legacy)</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <Label>Product *</Label>
              <SearchableSelect
                options={products.map((p) => ({ value: p.id, label: p.name }))}
                value={legacyForm.productId}
                onChange={(v) => setLegacyForm({ ...legacyForm, productId: v })}
                placeholder="Select product..."
              />
            </div>
            <div>
              <Label>Distributor</Label>
              <SearchableSelect
                options={distributors.map((d: Distributor) => ({ value: d.id, label: d.name }))}
                value={legacyForm.distributorId}
                onChange={(v) => setLegacyForm({ ...legacyForm, distributorId: v })}
                placeholder="Select distributor..."
              />
            </div>
            <div>
              <Label>Invoice Number</Label>
              <Input
                value={legacyForm.invoiceNumber}
                onChange={(e) => setLegacyForm({ ...legacyForm, invoiceNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>Packs Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={legacyForm.quantity}
                onChange={(e) => setLegacyForm({ ...legacyForm, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={legacyForm.expiry}
                onChange={(e) => setLegacyForm({ ...legacyForm, expiry: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              disabled={!legacyForm.productId || !legacyForm.quantity || legacyCreateMutation.isPending}
              onClick={() => legacyCreateMutation.mutate()}
            >
              {legacyCreateMutation.isPending ? "Recording..." : "Record Single Stock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Stock Entry"
        description="Are you sure you want to remove this stock entry?"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) legacyDeleteMutation.mutate(deleteId); }}
        loading={legacyDeleteMutation.isPending}
      />
    </div>
  );
}
