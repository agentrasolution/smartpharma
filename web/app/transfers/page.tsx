"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalNav } from "@/components/portal-nav";
import {
  ArrowLeftRight, Send, PackageCheck, XCircle, Search,
  RefreshCw, Plus, Tag, ChevronDown, ChevronUp,
  ShieldCheck, Layers
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  StockTransfer, Branch, CrossBranchStockResponse, BranchPriceOverride, Product
} from "@/types";

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState<"transfers" | "cross-stock" | "pricing">("transfers");

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | "in" | "out">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Cross-stock finder states
  const [crossStockQuery, setCrossStockQuery] = useState("");
  const [crossStockResult, setCrossStockResult] = useState<CrossBranchStockResponse | null>(null);
  const [crossStockLoading, setCrossStockLoading] = useState(false);
  const [expandedBatchBranchId, setExpandedBatchBranchId] = useState<string | null>(null);

  // Modals
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [rejectModalTransferId, setRejectModalTransferId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // New transfer form
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [destBranchId, setDestBranchId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferNotes, setTransferNotes] = useState("");
  const [sendImmediately, setSendImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pricing rules modal
  const [selectedPricingBranch, setSelectedPricingBranch] = useState<Branch | null>(null);
  const [branchOverrides, setBranchOverrides] = useState<BranchPriceOverride[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overrideProductId, setOverrideProductId] = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  // Load transfers
  const loadTransfers = useCallback(async () => {
    setTransfersLoading(true);
    try {
      const res = await api.transfers.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        direction: directionFilter === "all" ? undefined : directionFilter,
        search: searchQuery.trim() || undefined,
      });
      setTransfers(res.data);
    } catch (err) {
      console.error("Failed to load transfers:", err);
    } finally {
      setTransfersLoading(false);
    }
  }, [statusFilter, directionFilter, searchQuery]);

  // Load branches
  const loadBranches = useCallback(async () => {
    try {
      const data = await api.branches.list();
      setBranches(data);
    } catch (err) {
      console.error("Failed to load branches:", err);
    }
  }, []);

  // Load products lookup
  const loadProducts = useCallback(async () => {
    try {
      const res = await api.products.list();
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadBranches();
      loadProducts();
    }, 0);
    return () => clearTimeout(t);
  }, [loadBranches, loadProducts]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadTransfers();
    }, 0);
    return () => clearTimeout(t);
  }, [loadTransfers]);

  // Load overrides for selected branch
  const loadBranchOverrides = useCallback(async (branchId: string) => {
    setOverridesLoading(true);
    try {
      const res = await api.branches.getPriceOverrides(branchId);
      setBranchOverrides(res.overrides);
    } catch (err) {
      console.error("Failed to load price overrides:", err);
    } finally {
      setOverridesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPricingBranch) {
      const t = setTimeout(() => {
        loadBranchOverrides(selectedPricingBranch.id);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [selectedPricingBranch, loadBranchOverrides]);

  // Handle cross-branch stock search
  const handleCrossStockSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!crossStockQuery.trim()) return;
    setCrossStockLoading(true);
    try {
      const res = await api.branches.crossBranchStock({
        barcode: crossStockQuery.trim(),
        productId: crossStockQuery.trim(),
      });
      setCrossStockResult(res);
    } catch (err) {
      console.error("Cross stock lookup error:", err);
      alert("Product not found across branches.");
    } finally {
      setCrossStockLoading(false);
    }
  };

  // Handle transfer actions
  const handleSend = async (id: string) => {
    if (!confirm("Dispatch this transfer now? Source branch stock will be decremented.")) return;
    setIsSubmitting(true);
    try {
      await api.transfers.send(id);
      await loadTransfers();
      if (selectedTransfer?.id === id) setSelectedTransfer(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to dispatch transfer";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceive = async (id: string) => {
    if (!confirm("Receive this transfer? Batches and quantities will be imported into destination branch.")) return;
    setIsSubmitting(true);
    try {
      await api.transfers.receive(id);
      await loadTransfers();
      if (selectedTransfer?.id === id) setSelectedTransfer(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to receive transfer";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalTransferId || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      await api.transfers.reject(rejectModalTransferId, rejectReason.trim());
      await loadTransfers();
      setRejectModalTransferId(null);
      setRejectReason("");
      if (selectedTransfer) setSelectedTransfer(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject transfer";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceBranchId || !destBranchId || !selectedProductId || transferQty < 1) {
      alert("Please fill in all required transfer fields");
      return;
    }
    if (sourceBranchId === destBranchId) {
      alert("Source and destination branches cannot be the same");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.transfers.create({
        sourceBranchId,
        destinationBranchId: destBranchId,
        notes: transferNotes,
        sendImmediately,
        items: [{ productId: selectedProductId, quantity: Number(transferQty) }],
      });
      await loadTransfers();
      setIsNewTransferOpen(false);
      // Reset form
      setTransferQty(1);
      setTransferNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create transfer";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPriceOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPricingBranch || !overrideProductId || !overridePrice) return;
    const p = parseFloat(overridePrice);
    if (isNaN(p) || p < 0) {
      alert("Please enter a valid price");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.branches.setPriceOverride(selectedPricingBranch.id, {
        productId: overrideProductId,
        salePrice: p,
        reason: overrideReason.trim() || undefined,
      });
      await loadBranchOverrides(selectedPricingBranch.id);
      setOverrideProductId("");
      setOverridePrice("");
      setOverrideReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to set price override";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePriceOverride = async (productId: string) => {
    if (!selectedPricingBranch) return;
    if (!confirm("Revert this product to standard catalog price?")) return;
    try {
      await api.branches.deletePriceOverride(selectedPricingBranch.id, productId);
      await loadBranchOverrides(selectedPricingBranch.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove price override";
      alert(msg);
    }
  };

  // Stats calculation
  const inTransitCount = transfers.filter((t) => t.status === "IN_TRANSIT").length;
  const pendingCount = transfers.filter((t) => t.status === "PENDING").length;
  const receivedCount = transfers.filter((t) => t.status === "RECEIVED").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PortalNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Multi-Branch Operations</h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                <ShieldCheck className="h-3 w-3" /> Batch Travel Enabled
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-1">
              Central catalog control, branch-level retail pricing overrides, and inter-branch stock transfers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (branches.length >= 2) {
                  setSourceBranchId(branches[0].id);
                  setDestBranchId(branches[1].id);
                }
                setIsNewTransferOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background font-semibold text-xs shadow-sm hover:opacity-90 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Stock Transfer
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface p-4 rounded-xl border border-border">
            <div className="text-xs text-text-secondary font-medium">Total Branches</div>
            <div className="text-2xl font-black text-text-primary mt-1">{branches.length}</div>
            <div className="text-[11px] text-text-secondary mt-0.5">Active across network</div>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-border">
            <div className="text-xs text-blue-600 font-medium">In-Transit Shipments</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{inTransitCount}</div>
            <div className="text-[11px] text-text-secondary mt-0.5">Awaiting branch receipt</div>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-border">
            <div className="text-xs text-amber-600 font-medium">Pending Requests</div>
            <div className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</div>
            <div className="text-[11px] text-text-secondary mt-0.5">Requires source dispatch</div>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-border">
            <div className="text-xs text-emerald-600 font-medium">Completed Transfers</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{receivedCount}</div>
            <div className="text-[11px] text-text-secondary mt-0.5">Stock & batches settled</div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab("transfers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "transfers"
                ? "bg-foreground text-background shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Stock Transfers Queue
            {inTransitCount + pendingCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "transfers" ? "bg-background text-foreground" : "bg-primary text-white"}`}>
                {inTransitCount + pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("cross-stock")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "cross-stock"
                ? "bg-foreground text-background shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
            }`}
          >
            <Layers className="h-4 w-4" />
            Cross-Branch Stock Finder
          </button>

          <button
            onClick={() => setActiveTab("pricing")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "pricing"
                ? "bg-foreground text-background shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
            }`}
          >
            <Tag className="h-4 w-4" />
            Branch Pricing Rules
          </button>
        </div>

        {/* =============================================================== */}
        {/* TAB 1: TRANSFERS QUEUE                                          */}
        {/* =============================================================== */}
        {activeTab === "transfers" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary font-medium">Status:</span>
                  {["all", "PENDING", "IN_TRANSIT", "RECEIVED", "REJECTED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        statusFilter === st
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                      }`}
                    >
                      {st === "all" ? "All Statuses" : st.replace("_", " ")}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary font-medium">Direction:</span>
                  {(["all", "out", "in"] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setDirectionFilter(dir)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        directionFilter === dir
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                      }`}
                    >
                      {dir === "all" ? "All" : dir === "out" ? "Outgoing" : "Incoming"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search transfer # or drug..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <button
                  onClick={loadTransfers}
                  title="Refresh transfers"
                  className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg border border-border hover:bg-surface-2 cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${transfersLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Transfers List */}
            {transfersLoading ? (
              <div className="py-20 text-center text-text-secondary">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-accent" />
                <p className="text-sm">Loading stock transfers...</p>
              </div>
            ) : transfers.length === 0 ? (
              <div className="py-20 text-center bg-surface rounded-2xl border border-border p-8">
                <ArrowLeftRight className="h-12 w-12 mx-auto text-text-secondary/40 mb-3" />
                <h3 className="font-semibold text-text-primary text-base">No stock transfers recorded</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  Transfer medicines between branches with full batch travel and automatic stock adjustments.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transfers.map((t) => (
                  <div
                    key={t.id}
                    className="bg-surface p-5 rounded-2xl border border-border hover:border-accent/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-text-primary">{t.transferNumber}</span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            t.status === "PENDING"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : t.status === "IN_TRANSIT"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : t.status === "RECEIVED"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          }`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {formatDate(t.createdAt)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <span className="font-semibold text-text-primary">{t.sourceBranch?.name || "Source"}</span>
                        <ArrowLeftRight className="h-3 w-3 text-accent shrink-0" />
                        <span className="font-semibold text-text-primary">{t.destinationBranch?.name || "Destination"}</span>
                        <span className="text-border">·</span>
                        <span>{t.items?.length || 0} line item(s)</span>
                        {t.requestedByName && <span>· Req: {t.requestedByName}</span>}
                        {t.approvedByName && <span>· Dispatched: {t.approvedByName}</span>}
                        {t.receivedByName && <span>· Received: {t.receivedByName}</span>}
                      </div>

                      {t.rejectionReason && (
                        <p className="text-xs text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-md inline-block">
                          Rejection Reason: {t.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedTransfer(t)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        View Items
                      </button>

                      {t.status === "PENDING" && (
                        <button
                          onClick={() => handleSend(t.id)}
                          disabled={isSubmitting}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Approve & Send
                        </button>
                      )}

                      {t.status === "IN_TRANSIT" && (
                        <>
                          <button
                            onClick={() => handleReceive(t.id)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            Receive Stock
                          </button>
                          <button
                            onClick={() => {
                              setRejectModalTransferId(t.id);
                              setRejectReason("");
                            }}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 text-xs font-medium border border-rose-600/20 transition-colors cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 2: CROSS-BRANCH STOCK FINDER                                */}
        {/* =============================================================== */}
        {activeTab === "cross-stock" && (
          <div className="bg-surface p-6 rounded-2xl border border-border space-y-6">
            <div className="max-w-xl space-y-1">
              <h2 className="text-base font-bold text-text-primary">Cross-Branch Stock Visibility</h2>
              <p className="text-xs text-text-secondary">
                Scan or enter any barcode or drug identifier to view on-hand inventory levels and batch breakdowns at every pharmacy branch.
              </p>
            </div>

            <form onSubmit={handleCrossStockSearch} className="flex gap-2 max-w-xl">
              <input
                type="text"
                value={crossStockQuery}
                onChange={(e) => setCrossStockQuery(e.target.value)}
                placeholder="Enter barcode or drug identifier (e.g. 628100001)..."
                className="flex-1 px-3.5 py-2 text-xs bg-surface-2 border border-border rounded-xl text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={!crossStockQuery.trim() || crossStockLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background font-semibold text-xs shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                {crossStockLoading ? "Searching..." : "Lookup Stock"}
              </button>
            </form>

            {crossStockResult && (
              <div className="pt-6 border-t border-border space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-surface-2 rounded-2xl border border-border">
                  <div>
                    <h3 className="text-lg font-black text-text-primary">{crossStockResult.productName}</h3>
                    <p className="text-xs text-text-secondary font-mono">Barcode: {crossStockResult.barcode}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-secondary">Total Stock Across All Branches</div>
                    <div className="text-3xl font-black text-accent mt-0.5">
                      {crossStockResult.totalStockAcrossAllBranches}{" "}
                      <span className="text-xs font-normal text-text-secondary">units</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {crossStockResult.branches.map((b) => (
                    <div key={b.branchId} className="bg-surface-2/60 p-5 rounded-2xl border border-border space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-text-primary text-sm">{b.branchName}</h4>
                          <p className="text-[11px] text-text-secondary">{b.branchAddress || "No address on file"}</p>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            b.stockQty > 0
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-surface text-text-secondary border-border"
                          }`}
                        >
                          {b.stockQty} in stock
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs py-2.5 border-y border-border">
                        <div>
                          <span className="text-[10px] text-text-secondary block">Retail Price</span>
                          <span className="font-bold text-text-primary">{formatCurrency(b.effectiveSalePrice)}</span>
                          {b.hasPriceOverride && (
                            <span className="block text-[10px] text-accent font-medium">(Branch Override)</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-text-secondary block">Last Updated</span>
                          <span className="text-text-primary text-[11px]">
                            {b.lastUpdated ? formatDate(b.lastUpdated) : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Batches breakdown */}
                      {b.batches.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBatchBranchId(
                                expandedBatchBranchId === b.branchId ? null : b.branchId
                              )
                            }
                            className="flex items-center justify-between w-full text-[11px] font-medium text-text-secondary hover:text-text-primary cursor-pointer"
                          >
                            <span>{b.batches.length} Active Batch(es)</span>
                            {expandedBatchBranchId === b.branchId ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>

                          {expandedBatchBranchId === b.branchId && (
                            <div className="mt-2 space-y-1.5 p-2.5 bg-surface rounded-xl border border-border text-[11px]">
                              {b.batches.map((batch) => (
                                <div key={batch.id} className="flex justify-between items-center">
                                  <span className="font-mono text-text-primary">{batch.batchNumber}</span>
                                  <span className="text-text-secondary">Exp: {formatDate(batch.expiryDate)}</span>
                                  <span className="font-bold text-text-primary">{batch.quantity}u</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {b.stockQty > 0 && (
                        <button
                          onClick={() => {
                            setSourceBranchId(b.branchId);
                            const other = branches.find((br) => br.id !== b.branchId);
                            if (other) setDestBranchId(other.id);
                            if (b.productId) setSelectedProductId(b.productId);
                            setIsNewTransferOpen(true);
                          }}
                          className="w-full mt-2 py-1.5 rounded-lg border border-border hover:bg-surface text-xs font-semibold text-text-primary transition-colors cursor-pointer"
                        >
                          Request Stock From Here
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 3: BRANCH PRICING RULES                                     */}
        {/* =============================================================== */}
        {activeTab === "pricing" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => (
                <div key={b.id} className="bg-surface p-5 rounded-2xl border border-border space-y-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-text-primary text-base">{b.name}</h3>
                      <p className="text-xs text-text-secondary">{b.address || "No address"}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        b.allowPriceOverride
                          ? "bg-accent/10 text-accent border-accent/20"
                          : "bg-surface-2 text-text-secondary border-border"
                      }`}
                    >
                      {b.allowPriceOverride ? "Overrides Allowed" : "Central Price Only"}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed">
                    {b.allowPriceOverride
                      ? "This branch is permitted to set localized retail price overrides on catalog drugs."
                      : "Pricing is strictly governed by central catalog rules. Local branch price overrides are locked."}
                  </p>

                  <button
                    onClick={() => setSelectedPricingBranch(b)}
                    disabled={!b.allowPriceOverride}
                    className="w-full py-2 rounded-xl border border-border hover:bg-surface-2 disabled:opacity-40 text-xs font-semibold text-text-primary transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Tag className="h-3.5 w-3.5 text-accent" />
                    Manage Price Overrides
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* =============================================================== */}
      {/* MODAL: NEW TRANSFER                                             */}
      {/* =============================================================== */}
      {isNewTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-accent" />
                New Inter-Branch Stock Transfer
              </h3>
              <button
                onClick={() => setIsNewTransferOpen(false)}
                className="text-text-secondary hover:text-text-primary text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary font-medium">Source Branch (From)</label>
                  <select
                    value={sourceBranchId}
                    onChange={(e) => setSourceBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-2 border border-border rounded-xl text-text-primary"
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-text-secondary font-medium">Destination Branch (To)</label>
                  <select
                    value={destBranchId}
                    onChange={(e) => setDestBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-2 border border-border rounded-xl text-text-primary"
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.id === sourceBranchId}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-text-secondary font-medium">Select Medicine</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-2 border border-border rounded-xl text-text-primary"
                  required
                >
                  <option value="">Select drug to transfer...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.barcode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-text-secondary font-medium">Quantity (Units)</label>
                <input
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-xs bg-surface-2 border border-border rounded-xl text-text-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-text-secondary font-medium">Transfer Notes</label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Reason for transfer, driver details, or batch notes..."
                  className="w-full px-3 py-2 text-xs bg-surface-2 border border-border rounded-xl text-text-primary h-20"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-xl">
                <input
                  type="checkbox"
                  id="send-now"
                  checked={sendImmediately}
                  onChange={(e) => setSendImmediately(e.target.checked)}
                  className="rounded text-accent"
                />
                <label htmlFor="send-now" className="text-xs text-text-primary cursor-pointer">
                  <span className="font-semibold block">Dispatch Immediately (In-Transit)</span>
                  <span className="text-[11px] text-text-secondary">
                    Source stock will be deducted now and prepared for shipment.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-foreground text-background font-semibold text-xs shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Creating Transfer..." : "Confirm & Create Transfer"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* MODAL: TRANSFER DETAIL & BATCH TRAVEL VERIFICATION              */}
      {/* =============================================================== */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-text-primary text-base">
                  Transfer Details: {selectedTransfer.transferNumber}
                </h3>
                <span className="text-xs text-text-secondary">
                  Initiated on {formatDate(selectedTransfer.createdAt)}
                </span>
              </div>
              <button
                onClick={() => setSelectedTransfer(null)}
                className="text-text-secondary hover:text-text-primary text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-surface-2 rounded-xl text-xs">
              <div>
                <span className="text-text-secondary block">Source Branch</span>
                <span className="font-bold text-text-primary">{selectedTransfer.sourceBranch?.name}</span>
              </div>
              <div>
                <span className="text-text-secondary block">Destination Branch</span>
                <span className="font-bold text-text-primary">{selectedTransfer.destinationBranch?.name}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Transferred Items & Batch Travel Info
              </h4>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-2 text-text-secondary border-b border-border">
                    <tr>
                      <th className="p-3">Medicine</th>
                      <th className="p-3">Traveled Batch #</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedTransfer.items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-2/40">
                        <td className="p-3 font-semibold text-text-primary">{item.productName}</td>
                        <td className="p-3 font-mono text-accent font-bold">{item.batchNumber}</td>
                        <td className="p-3 text-text-secondary">{formatDate(item.expiryDate)}</td>
                        <td className="p-3 font-black text-text-primary">{item.quantity}</td>
                        <td className="p-3 text-text-secondary">{formatCurrency(item.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedTransfer.notes && (
              <div className="p-3 bg-surface-2 rounded-xl text-xs">
                <span className="font-semibold text-text-primary block">Transfer Notes:</span>
                <p className="text-text-secondary mt-0.5">{selectedTransfer.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              {selectedTransfer.status === "PENDING" && (
                <button
                  onClick={() => handleSend(selectedTransfer.id)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer"
                >
                  Approve & Dispatch
                </button>
              )}
              {selectedTransfer.status === "IN_TRANSIT" && (
                <button
                  onClick={() => handleReceive(selectedTransfer.id)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer"
                >
                  Receive Stock into Destination Branch
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* MODAL: BRANCH PRICE OVERRIDES                                   */}
      {/* =============================================================== */}
      {selectedPricingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                  <Tag className="h-4 w-4 text-accent" />
                  Branch Price Overrides: {selectedPricingBranch.name}
                </h3>
                <span className="text-xs text-text-secondary">
                  Custom retail pricing active for this branch location.
                </span>
              </div>
              <button
                onClick={() => setSelectedPricingBranch(null)}
                className="text-text-secondary hover:text-text-primary text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPriceOverride} className="p-4 bg-surface-2 rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Set New Price Override</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-text-secondary font-medium">Select Drug</label>
                  <select
                    value={overrideProductId}
                    onChange={(e) => setOverrideProductId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text-primary"
                    required
                  >
                    <option value="">Choose medicine...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Catalog: {formatCurrency(p.sale_price ?? 0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-text-secondary font-medium">Branch Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 19.99"
                    value={overridePrice}
                    onChange={(e) => setOverridePrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text-primary"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-text-secondary font-medium">Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Airport location"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !overrideProductId || !overridePrice}
                className="w-full py-2 rounded-xl bg-foreground text-background font-semibold text-xs shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Saving..." : "Save Branch Price Override"}
              </button>
            </form>

            {/* Overrides Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Active Overrides</h4>
              {overridesLoading ? (
                <div className="py-8 text-center text-xs text-text-secondary">Loading price overrides...</div>
              ) : branchOverrides.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-secondary bg-surface-2 rounded-xl">
                  No price overrides configured. Central catalog prices apply.
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-2 text-text-secondary border-b border-border">
                      <tr>
                        <th className="p-2.5">Medicine</th>
                        <th className="p-2.5">Catalog Price</th>
                        <th className="p-2.5">Branch Price</th>
                        <th className="p-2.5">Reason</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {branchOverrides.map((o) => (
                        <tr key={o.id} className="hover:bg-surface-2/40">
                          <td className="p-2.5 font-semibold text-text-primary">{o.productName}</td>
                          <td className="p-2.5 text-text-secondary">{formatCurrency(o.catalogPrice)}</td>
                          <td className="p-2.5 font-black text-accent">{formatCurrency(o.overridePrice)}</td>
                          <td className="p-2.5 text-text-secondary">{o.reason || "—"}</td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => handleDeletePriceOverride(o.productId)}
                              className="text-text-secondary hover:text-danger text-xs px-2 py-1 rounded cursor-pointer"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* MODAL: REJECT REASON                                            */}
      {/* =============================================================== */}
      {rejectModalTransferId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-text-primary text-base">Reject Stock Transfer</h3>
            <p className="text-xs text-text-secondary">
              Rejecting this transfer will automatically return all deducted stock and batches back to the source branch.
            </p>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary font-medium">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Package damaged in transit, temperature violation..."
                className="w-full px-3 py-2 text-xs bg-surface-2 border border-border rounded-xl text-text-primary h-24"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModalTransferId(null)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={isSubmitting || !rejectReason.trim()}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Reverting Stock..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
