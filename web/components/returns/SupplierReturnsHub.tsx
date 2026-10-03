"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RotateCcw,
  Truck,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Printer,
  Package,
  Calendar,
  FileText,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type {
  SupplierReturn,
  ReturnCandidate,
  CreateSupplierReturnInput,
  Distributor,
  ReturnReason,
} from "@/types";

const REASON_LABELS: Record<string, string> = {
  NEAR_EXPIRY: "Near Expiry (<90d)",
  DAMAGED: "Damaged / Broken",
  RECALLED: "Manufacturer / SFDA Recall",
  EXCESS_STOCK: "Overstocked / Slow Moving",
  EXPIRED: "Expired Stock",
  WRONG_ITEM: "Wrong Item Received",
  OTHER: "Other Reason",
};

export default function SupplierReturnsHub() {
  const queryClient = useQueryClient();

  // Search & filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>("");

  // Modal open states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [candidatesDrawerOpen, setCandidatesDrawerOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SupplierReturn | null>(null);

  // Form states - Create Return
  const [formDistributorId, setFormDistributorId] = useState("");
  const [formReason, setFormReason] = useState<ReturnReason>("NEAR_EXPIRY");
  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formAutoApprove, setFormAutoApprove] = useState(true);
  const [formCreditNoteNumber, setFormCreditNoteNumber] = useState("");
  const [returnItems, setReturnItems] = useState<
    Array<{
      productId: string;
      productName: string;
      batchId?: string;
      batchNumber: string;
      expiryDate?: string;
      quantityPacks: number;
      unitsPerPack: number;
      unitCost: number;
      reason: string;
    }>
  >([]);

  // Item entry sub-form in create modal
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [itemBatchNumber, setItemBatchNumber] = useState("");
  const [itemExpiryDate, setItemExpiryDate] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemUnitCost, setItemUnitCost] = useState(0);

  // Credit Note Form
  const [creditNoteNumInput, setCreditNoteNumInput] = useState("");
  const [creditNoteDateInput, setCreditNoteDateInput] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // 1. Fetch Returns List
  const { data: returnsData, isLoading } = useQuery({
    queryKey: ["supplier-returns", statusFilter, selectedDistributorId, search],
    queryFn: () =>
      api.supplierReturns.list({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        distributorId: selectedDistributorId || undefined,
        search: search.trim() || undefined,
        pageSize: 50,
      }),
  });

  // 2. Fetch Near-Expiry / Recalled Candidates
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ["supplier-return-candidates", selectedDistributorId],
    queryFn: () => api.supplierReturns.getCandidates(selectedDistributorId || undefined, 90),
  });

  // 3. Fetch Distributors
  const { data: distributors = [] } = useQuery({
    queryKey: ["distributors"],
    queryFn: api.distributors.list,
  });

  // 4. Product search for item addition
  const { data: searchedProducts = [] } = useQuery({
    queryKey: ["products-search", productSearch],
    queryFn: () => api.products.search(productSearch),
    enabled: productSearch.trim().length > 1,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateSupplierReturnInput) => api.supplierReturns.create(payload),
    onSuccess: (newRet) => {
      queryClient.invalidateQueries({ queryKey: ["supplier-returns"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-return-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["distributor-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setCreateModalOpen(false);
      resetCreateForm();
      toast.success(`Supplier Return #${newRet.returnNumber} created successfully!`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create supplier return");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (args: { id: string; creditNoteNumber?: string; notes?: string }) =>
      api.supplierReturns.approve(args.id, {
        creditNoteNumber: args.creditNoteNumber,
        notes: args.notes,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["supplier-returns"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-return-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["distributor-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (selectedReturn?.id === updated.id) setSelectedReturn(updated);
      setCreditNoteModalOpen(false);
      toast.success(`RTV #${updated.returnNumber} approved & stock deducted!`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to approve return");
    },
  });

  const resetCreateForm = () => {
    setFormDistributorId("");
    setFormReason("NEAR_EXPIRY");
    setFormInvoiceId("");
    setFormNotes("");
    setFormAutoApprove(true);
    setFormCreditNoteNumber("");
    setReturnItems([]);
    setSelectedProduct(null);
    setProductSearch("");
  };

  const handleAddItemToReturn = () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }
    if (!itemBatchNumber.trim()) {
      toast.error("Please enter batch number");
      return;
    }
    if (itemQty <= 0) {
      toast.error("Quantity must be at least 1");
      return;
    }

    setReturnItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        batchNumber: itemBatchNumber.trim(),
        expiryDate: itemExpiryDate || undefined,
        quantityPacks: itemQty,
        unitsPerPack: selectedProduct.pack_size || 1,
        unitCost: itemUnitCost,
        reason: formReason,
      },
    ]);

    // Clear sub-form
    setSelectedProduct(null);
    setProductSearch("");
    setItemBatchNumber("");
    setItemExpiryDate("");
    setItemQty(1);
    setItemUnitCost(0);
  };

  const handleAddCandidateToReturn = (c: ReturnCandidate) => {
    // Set distributor if not set
    if (!formDistributorId && c.distributorId) {
      setFormDistributorId(c.distributorId);
    }

    setReturnItems((prev) => [
      ...prev,
      {
        productId: c.productId,
        productName: c.productName,
        batchId: c.batchId,
        batchNumber: c.batchNumber,
        expiryDate: c.expiryDate,
        quantityPacks: c.quantityAvailable,
        unitsPerPack: c.packSize || 1,
        unitCost: c.unitCost,
        reason: c.suggestedReason,
      },
    ]);

    toast.success(`Added ${c.productName} (${c.batchNumber}) to return items`);
    setCandidatesDrawerOpen(false);
    setCreateModalOpen(true);
  };

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDistributorId) {
      toast.error("Please select a distributor");
      return;
    }
    if (returnItems.length === 0) {
      toast.error("Please add at least one medicine item to return");
      return;
    }

    createMutation.mutate({
      distributorId: formDistributorId,
      reason: formReason,
      invoiceId: formInvoiceId.trim() || undefined,
      notes: formNotes.trim(),
      autoApprove: formAutoApprove,
      creditNoteNumber: formCreditNoteNumber.trim() || undefined,
      items: returnItems.map((it) => ({
        productId: it.productId,
        batchId: it.batchId,
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate,
        quantityPacks: it.quantityPacks,
        unitsPerPack: it.unitsPerPack,
        unitCost: it.unitCost,
        reason: it.reason,
      })),
    });
  };

  const returnsList = returnsData?.data || [];
  const totalReturnsCount = returnsData?.total || 0;
  const pendingCount = returnsList.filter((r) => r.status === "PENDING").length;
  const approvedTotalSum = returnsList
    .filter((r) => r.status === "APPROVED" || r.status === "COMPLETED")
    .reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="space-y-4">
      {/* 1. Header Metrics & KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                Total RTV Returns
              </div>
              <div className="text-xl font-bold font-mono text-text-primary mt-1">
                {totalReturnsCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Truck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                Pending Approval
              </div>
              <div className="text-xl font-bold font-mono text-amber-500 mt-1">
                {pendingCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                Approved / Credited Value
              </div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(approvedTotalSum)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border hover:border-amber-500/50 transition-colors cursor-pointer" onClick={() => setCandidatesDrawerOpen(true)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Near-Expiry Eligible
              </div>
              <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {candidates.length} Batches
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Toolbar & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface border border-border rounded-xl p-3">
        <div className="flex flex-1 items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-text-secondary absolute left-2.5 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search RTV #, Credit Note #, distributor, notes..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-background px-2.5 py-1 text-text-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved / Credited</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Distributor filter */}
          <select
            value={selectedDistributorId}
            onChange={(e) => setSelectedDistributorId(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-background px-2.5 py-1 text-text-primary max-w-[180px]"
          >
            <option value="">All Distributors</option>
            {distributors.map((d: Distributor) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCandidatesDrawerOpen(true)}
            className="h-8 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            Scan Expiry Candidates ({candidates.length})
          </Button>

          <Button
            size="sm"
            onClick={() => {
              resetCreateForm();
              setCreateModalOpen(true);
            }}
            className="h-8 text-xs bg-accent text-accent-foreground hover:bg-accent-hover gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Supplier Return (RTV)
          </Button>
        </div>
      </div>

      {/* 3. Supplier Returns Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-text-secondary uppercase border-b border-border">
              <tr>
                <th className="py-3 px-4 font-semibold">Return Voucher #</th>
                <th className="py-3 px-4 font-semibold">Distributor</th>
                <th className="py-3 px-4 font-semibold">Reason</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold text-center">Items</th>
                <th className="py-3 px-4 font-semibold text-right">Return Value</th>
                <th className="py-3 px-4 font-semibold">Status / Credit Note</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-secondary">
                    Loading supplier returns...
                  </td>
                </tr>
              ) : returnsList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-secondary">
                    No supplier returns found. Click "New Supplier Return (RTV)" to initiate a return.
                  </td>
                </tr>
              ) : (
                returnsList.map((ret: SupplierReturn) => {
                  const statusColors = {
                    PENDING: "border-amber-500/30 text-amber-600 bg-amber-500/10",
                    APPROVED: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",
                    COMPLETED: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",
                    REJECTED: "border-rose-500/30 text-rose-600 bg-rose-500/10",
                  };
                  return (
                    <tr key={ret.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-accent">
                        {ret.returnNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-text-primary">
                        {ret.distributor?.name || "Distributor"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-text-secondary">
                          {REASON_LABELS[ret.reason] || ret.reason}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">
                        {formatDateTime(ret.returnDate)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium">
                        {ret.items?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                        {formatCurrency(ret.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] w-fit font-semibold uppercase ${
                              statusColors[ret.status] || ""
                            }`}
                          >
                            {ret.status}
                          </Badge>
                          {ret.creditNoteNumber && (
                            <span className="text-[10px] text-text-secondary font-mono">
                              CN: {ret.creditNoteNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedReturn(ret);
                              setDetailModalOpen(true);
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            View
                          </Button>
                          {ret.status === "PENDING" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedReturn(ret);
                                setCreditNoteNumInput("");
                                setCreditNoteModalOpen(true);
                              }}
                              className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              Approve
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE NEW SUPPLIER RETURN (RTV) */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-accent">
              <Truck className="w-5 h-5" />
              <DialogTitle>New Supplier Return (Return to Vendor - RTV)</DialogTitle>
            </div>
            <DialogDescription>
              Create a formal return voucher for near-expiry, damaged, or recalled stock to receive distributor credit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReturn} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-distributor">Distributor / Supplier *</Label>
                <select
                  id="form-distributor"
                  required
                  value={formDistributorId}
                  onChange={(e) => setFormDistributorId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text-primary"
                >
                  <option value="">Select Distributor...</option>
                  {distributors.map((d: Distributor) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="form-reason">Primary Return Reason *</Label>
                <select
                  id="form-reason"
                  required
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text-primary"
                >
                  {Object.entries(REASON_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items Card / Entry */}
            <div className="border border-border rounded-xl p-3 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-text-primary flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-accent" />
                  Medicines to Return ({returnItems.length})
                </span>
                <span className="font-mono text-xs font-bold text-accent">
                  Total: {formatCurrency(returnItems.reduce((s, it) => s + it.quantityPacks * it.unitCost, 0))}
                </span>
              </div>

              {/* Sub-form: Add medicine */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-surface border border-border rounded-lg items-end text-xs">
                <div className="sm:col-span-4 space-y-1">
                  <Label className="text-[11px]">Product Search</Label>
                  <Input
                    placeholder="Search medicine..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      if (selectedProduct) setSelectedProduct(null);
                    }}
                    className="h-8 text-xs"
                  />
                  {searchedProducts.length > 0 && !selectedProduct && (
                    <div className="absolute z-10 w-64 bg-surface border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto mt-1 divide-y divide-border/40">
                      {searchedProducts.slice(0, 5).map((p: any) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProduct(p);
                            setProductSearch(p.name);
                            setItemUnitCost(Number(p.cost_price || p.sale_price * 0.7 || 0));
                          }}
                          className="p-2 hover:bg-surface-hover cursor-pointer"
                        >
                          <div className="font-medium text-xs text-text-primary">{p.name}</div>
                          <div className="text-[10px] text-text-secondary font-mono">{p.barcode} • Stock: {p.stock_qty}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-[11px]">Batch #</Label>
                  <Input
                    placeholder="e.g. B982"
                    value={itemBatchNumber}
                    onChange={(e) => setItemBatchNumber(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[11px]">Packs</Label>
                  <Input
                    type="number"
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(parseInt(e.target.value, 10) || 1)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[11px]">Unit Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemUnitCost}
                    onChange={(e) => setItemUnitCost(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    onClick={handleAddItemToReturn}
                    className="h-8 w-full p-0 bg-accent text-accent-foreground"
                    title="Add item"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Items List Table */}
              {returnItems.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-text-secondary uppercase border-b border-border text-[10px]">
                      <tr>
                        <th className="py-2 px-3 text-left">Medicine</th>
                        <th className="py-2 px-3 text-left">Batch</th>
                        <th className="py-2 px-3 text-right">Packs</th>
                        <th className="py-2 px-3 text-right">Unit Cost</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {returnItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="py-2 px-3 font-medium text-text-primary">{item.productName}</td>
                          <td className="py-2 px-3 font-mono text-text-secondary">{item.batchNumber}</td>
                          <td className="py-2 px-3 text-right font-mono">{item.quantityPacks}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.unitCost)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-accent">
                            {formatCurrency(item.quantityPacks * item.unitCost)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setReturnItems((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-rose-500 hover:text-rose-700 text-xs px-1"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-invoice">Linked Purchase Invoice # (Optional)</Label>
                <Input
                  id="form-invoice"
                  placeholder="e.g. INV-9042"
                  value={formInvoiceId}
                  onChange={(e) => setFormInvoiceId(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="form-cn">Distributor Credit Memo / Authorization # (Optional)</Label>
                <Input
                  id="form-cn"
                  placeholder="e.g. CN-ALDAWAA-4401"
                  value={formCreditNoteNumber}
                  onChange={(e) => setFormCreditNoteNumber(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="form-notes">Notes / Driver Details</Label>
              <Textarea
                id="form-notes"
                placeholder="e.g. Return handed over to distributor driver, signed collection receipt attached."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-surface text-xs">
              <input
                type="checkbox"
                id="auto-approve-toggle"
                checked={formAutoApprove}
                onChange={(e) => setFormAutoApprove(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="auto-approve-toggle" className="cursor-pointer text-xs">
                <strong>Execute & Deduct Stock Immediately</strong> (Generates Credit Note & logs RTV stock movement in ledger)
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || returnItems.length === 0}
                className="bg-accent text-accent-foreground hover:bg-accent-hover"
              >
                {createMutation.isPending ? "Submitting..." : "Generate RTV Voucher"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: NEAR-EXPIRY / RECALL CANDIDATES SCANNER */}
      <Dialog open={candidatesDrawerOpen} onOpenChange={setCandidatesDrawerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
              <DialogTitle>Near-Expiry & Recalled Return Candidates</DialogTitle>
            </div>
            <DialogDescription>
              Batches in stock expiring within 90 days or recalled by SFDA/distributors eligible for return to vendor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {loadingCandidates ? (
              <div className="py-12 text-center text-text-secondary text-xs">Scanning inventory...</div>
            ) : candidates.length === 0 ? (
              <div className="py-12 text-center text-text-secondary text-xs">
                No near-expiry or recalled batches found in current inventory. Excellent stock turnover!
              </div>
            ) : (
              <div className="divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
                {candidates.map((c, i) => (
                  <div key={i} className="p-3 bg-surface hover:bg-muted/10 transition-colors flex items-center justify-between text-xs gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold text-text-primary flex items-center gap-2">
                        {c.productName}
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase ${
                            c.suggestedReason === "RECALLED"
                              ? "border-rose-500/30 text-rose-600 bg-rose-500/10"
                              : c.daysToExpiry <= 0
                              ? "border-red-500/30 text-red-600 bg-red-500/10"
                              : "border-amber-500/30 text-amber-600 bg-amber-500/10"
                          }`}
                        >
                          {c.suggestedReason} ({c.daysToExpiry <= 0 ? "Expired" : `${c.daysToExpiry}d left`})
                        </Badge>
                      </div>
                      <div className="text-[11px] text-text-secondary flex items-center gap-3">
                        <span>Batch: <strong className="font-mono text-text-primary">{c.batchNumber}</strong></span>
                        <span>Exp: {new Date(c.expiryDate).toLocaleDateString()}</span>
                        <span>Distributor: {c.distributorName}</span>
                      </div>
                      <div className="text-[11px] font-mono">
                        Available Stock: <strong>{c.quantityAvailable} units</strong> • Estimated Cost: {formatCurrency(c.unitCost * c.quantityAvailable)}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAddCandidateToReturn(c)}
                      className="shrink-0 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                    >
                      Add to RTV
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCandidatesDrawerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: VIEW RTV VOUCHER DETAIL */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent">
                <FileText className="w-5 h-5" />
                <DialogTitle>Supplier Return Voucher #{selectedReturn?.returnNumber}</DialogTitle>
              </div>
              <Badge variant="outline" className="uppercase text-[10px]">
                {selectedReturn?.status}
              </Badge>
            </div>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-4 py-2 text-xs">
              {/* Header meta */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface border border-border rounded-lg">
                <div>
                  <span className="text-text-secondary">Distributor:</span>{" "}
                  <strong>{selectedReturn.distributor?.name}</strong>
                </div>
                <div>
                  <span className="text-text-secondary">Return Date:</span>{" "}
                  <strong>{formatDateTime(selectedReturn.returnDate)}</strong>
                </div>
                <div>
                  <span className="text-text-secondary">Primary Reason:</span>{" "}
                  <strong>{REASON_LABELS[selectedReturn.reason] || selectedReturn.reason}</strong>
                </div>
                <div>
                  <span className="text-text-secondary">Credit Note:</span>{" "}
                  <strong className="font-mono text-accent">
                    {selectedReturn.creditNoteNumber || "Pending"}
                  </strong>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-text-secondary uppercase border-b border-border text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Medicine Name</th>
                      <th className="py-2.5 px-3 text-left">Batch #</th>
                      <th className="py-2.5 px-3 text-right">Packs</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {selectedReturn.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-medium text-text-primary">{it.productName}</td>
                        <td className="py-2.5 px-3 font-mono text-text-secondary">{it.batchNumber}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{it.quantityPacks}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(it.unitCost)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-accent">
                          {formatCurrency(it.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border font-bold bg-muted/20">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right">Total Return Value:</td>
                      <td className="py-2.5 px-3 text-right font-mono text-accent">
                        {formatCurrency(selectedReturn.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedReturn.notes && (
                <div className="p-2.5 rounded-lg border border-border bg-surface text-text-secondary text-[11px]">
                  <strong>Notes:</strong> {selectedReturn.notes}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
              Close
            </Button>
            {selectedReturn?.status === "PENDING" && (
              <Button
                onClick={() => {
                  setDetailModalOpen(false);
                  setCreditNoteNumInput("");
                  setCreditNoteModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Approve & Deduct Stock
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: APPROVE & CREDIT NOTE ENTRY */}
      <Dialog open={creditNoteModalOpen} onOpenChange={setCreditNoteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <DialogTitle>Approve Supplier Return #{selectedReturn?.returnNumber}</DialogTitle>
            </div>
            <DialogDescription>
              Confirming approval deducts {selectedReturn?.items.length} items from pharmacy inventory and registers a Credit Note in the distributor ledger.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedReturn) return;
              approveMutation.mutate({
                id: selectedReturn.id,
                creditNoteNumber: creditNoteNumInput.trim() || undefined,
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="cn-input">Distributor Credit Note / Memo # (Optional)</Label>
              <Input
                id="cn-input"
                placeholder="e.g. CN-ALDAWAA-0041"
                value={creditNoteNumInput}
                onChange={(e) => setCreditNoteNumInput(e.target.value)}
                className="font-mono text-xs"
                autoFocus
              />
              <span className="text-[11px] text-text-secondary">
                If the distributor hasn't issued a number yet, leave blank. The RTV number will be used.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreditNoteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={approveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {approveMutation.isPending ? "Approving..." : "Confirm & Execute Return"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
