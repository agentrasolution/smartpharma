"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, getTenantCurrency, cn } from "@/lib/utils";
import type {
  DrugMasterProduct,
  DrugMasterDetail,
  DosageForm,
  BaseUnit,
  PackageUnit,
  BulkImportResult,
  ExpiryScanResult,
} from "@/types";
import {
  Pill,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  Upload,
  RefreshCw,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  Copy,
  Info,
  Calendar,
  AlertCircle,
  Clock,
} from "lucide-react";

const DOSAGE_FORMS: DosageForm[] = [
  "TABLET",
  "CAPSULE",
  "SYRUP",
  "INJECTION",
  "CREAM",
  "DROPS",
  "INHALER",
  "PATCH",
  "SUPPOSITORY",
  "OTHER",
];

const BASE_UNITS: BaseUnit[] = ["TABLET", "CAPSULE", "ML", "MG", "UNIT", "PIECE"];
const PACKAGE_UNITS: PackageUnit[] = ["BOX", "BOTTLE", "STRIP", "VIAL", "TUBE", "SACHET", "PIECE"];

export default function DrugMasterPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Data states
  const [drugs, setDrugs] = useState<DrugMasterProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "rx" | "controlled" | "regulated" | "incomplete">("all");
  const [selectedDosageForm, setSelectedDosageForm] = useState<string>("");
  const [availableDosageForms, setAvailableDosageForms] = useState<string[]>(DOSAGE_FORMS);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    rx: 0,
    controlled: 0,
    regulated: 0,
    incomplete: 0,
  });

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Drawers
  const [editProduct, setEditProduct] = useState<DrugMasterProduct | null>(null);
  const [detailProduct, setDetailProduct] = useState<DrugMasterDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isScanRunning, setIsScanRunning] = useState(false);
  const [scanResult, setScanResult] = useState<ExpiryScanResult | null>(null);

  const [nowMs, setNowMs] = useState(0);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Auth Guard
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Show temporary toast notification
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ type, message });
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch dosage forms in use
  useEffect(() => {
    api.drugMaster
      .listDosageForms()
      .then((forms) => {
        if (forms && forms.length > 0) {
          const merged = Array.from(new Set([...forms, ...DOSAGE_FORMS]));
          setAvailableDosageForms(merged);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch KPI stats
  const fetchStats = useCallback(async () => {
    try {
      const [allRes, rxRes, ctrlRes, regRes, incRes] = await Promise.all([
        api.drugMaster.search({ limit: 1 }),
        api.drugMaster.search({ isRx: true, limit: 1 }),
        api.drugMaster.search({ isControlled: true, limit: 1 }),
        api.drugMaster.search({ isRx: true, limit: 1 }), // fallback proxy
        api.drugMaster.listIncomplete(1, 1),
      ]);
      setStats({
        total: allRes.meta.total,
        rx: rxRes.meta.total,
        controlled: ctrlRes.meta.total,
        regulated: regRes.meta.total,
        incomplete: incRes.meta.total,
      });
    } catch {
      // stats failure is non-fatal
    }
  }, []);

  // Main data fetch
  const fetchDrugs = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === "incomplete") {
        const res = await api.drugMaster.listIncomplete(page, limit);
        setDrugs(res.data);
        setTotalCount(res.meta.total);
      } else {
        const params: Parameters<typeof api.drugMaster.search>[0] = {
          q: searchQuery.trim() || undefined,
          dosageForm: selectedDosageForm || undefined,
          page,
          limit,
        };
        if (activeTab === "rx") params.isRx = true;
        if (activeTab === "controlled") params.isControlled = true;

        const res = await api.drugMaster.search(params);
        setDrugs(res.data);
        setTotalCount(res.meta.total);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load drug master catalog";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, limit, searchQuery, selectedDosageForm]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      void fetchDrugs();
      void fetchStats();
    }, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated, fetchDrugs, fetchStats]);

  // Handle single view details
  const handleOpenDetails = async (product: DrugMasterProduct) => {
    setNowMs(Date.now());
    setIsLoadingDetail(true);
    setDetailProduct(null);
    try {
      const full = await api.drugMaster.getById(product.id);
      setDetailProduct(full);
    } catch {
      setDetailProduct(product);
      showToast("Could not load real-time active batch details", "error");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Trigger on-demand expiry scan
  const handleRunExpiryScan = async () => {
    setIsScanRunning(true);
    try {
      const res = await api.drugMaster.runExpiryScan(90);
      setScanResult(res);
      showToast(
        `Expiry scan complete! Marked ${res.expiredMarked} expired, ${res.nearExpiryAlerts} alerts flagged.`,
        "success"
      );
      fetchDrugs();
      fetchStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Scan failed", "error");
    } finally {
      setIsScanRunning(false);
    }
  };

  // Selection toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCurrentPage = () => {
    if (selectedIds.size === drugs.length && drugs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drugs.map((d) => d.id)));
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="space-y-6">
        {/* Toast Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className={cn(
                "p-4 rounded-xl shadow-lg border flex items-center justify-between gap-3 text-sm z-50",
                notification.type === "success" && "bg-success/10 border-success/30 text-success font-medium",
                notification.type === "error" && "bg-danger/10 border-danger/30 text-danger font-medium",
                notification.type === "info" && "bg-accent/10 border-accent/30 text-accent font-medium"
              )}
            >
              <div className="flex items-center gap-2.5">
                {notification.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {notification.type === "error" && <AlertTriangle className="h-4 w-4 shrink-0" />}
                {notification.type === "info" && <Info className="h-4 w-4 shrink-0" />}
                <span>{notification.message}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="p-1 rounded hover:bg-black/5 cursor-pointer text-text-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <Pill className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Drug Master Data Catalog
              </h1>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Standardized pharmaceutical registry • Drug regulatory classification • Regulated ceiling pricing & multi-unit pack conversions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunExpiryScan}
              disabled={isScanRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-all cursor-pointer disabled:opacity-50"
              title="Audit active batches for FEFO status and near-expiry alerts"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isScanRunning && "animate-spin text-accent")} />
              {isScanRunning ? "Scanning Batches..." : "FEFO Expiry Scan"}
            </button>

            <button
              onClick={() => setIsBulkImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-all cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              Import Master JSON
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={() => setIsBulkEditOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold shadow-sm hover:bg-accent-hover transition-all cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Bulk Edit ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Expiry Scan Result Banner */}
        {scanResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-between gap-3 text-xs text-text-primary shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
              <span>
                <strong>FEFO Expiry Scan Results:</strong> Marked <strong>{scanResult.expiredMarked}</strong> lot(s) as expired, <strong>{scanResult.depletedMarked}</strong> as depleted, and flagged <strong>{scanResult.nearExpiryAlerts}</strong> active near-expiry alerts.
              </span>
            </div>
            <button
              onClick={() => setScanResult(null)}
              className="p-1 rounded-lg hover:bg-black/5 cursor-pointer text-text-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary flex items-center justify-between">
              Total Catalog
              <Pill className="h-3.5 w-3.5 text-accent" />
            </span>
            <div className="text-2xl font-bold text-text-primary">{stats.total.toLocaleString()}</div>
            <p className="text-[10px] text-text-secondary">Registered SKU items</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary flex items-center justify-between">
              Rx Prescription
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats.rx.toLocaleString()}
            </div>
            <p className="text-[10px] text-text-secondary">Requires doctor prescription</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary flex items-center justify-between">
              Controlled Meds
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            </span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.controlled.toLocaleString()}
            </div>
            <p className="text-[10px] text-text-secondary">Narcotics / Controlled Schedule</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary flex items-center justify-between">
              Price Regulated
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            </span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.regulated.toLocaleString()}
            </div>
            <p className="text-[10px] text-text-secondary">Official regulated price ceiling</p>
          </div>

          <button
            onClick={() => setActiveTab("incomplete")}
            className={cn(
              "p-4 rounded-xl border text-left shadow-xs space-y-1 transition-all cursor-pointer group",
              activeTab === "incomplete"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300"
                : "bg-surface border-border hover:border-amber-400/50"
            )}
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
              Data Quality
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
            </span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.incomplete.toLocaleString()}
            </div>
            <p className="text-[10px] text-text-secondary">Missing registration code or names</p>
          </button>
        </div>

        {/* Search, Filter Tabs & Tooling */}
        <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-border/80 w-fit">
              {[
                { id: "all", label: "All Items" },
                { id: "rx", label: "Rx Only" },
                { id: "controlled", label: "Controlled" },
                { id: "incomplete", label: `Incomplete (${stats.incomplete})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as typeof activeTab);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    activeTab === tab.id
                      ? "bg-surface text-text-primary shadow-xs font-semibold"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right: Search & Dosage Form Selector */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search trade name, generic, reg. code, barcode..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 pl-9 pr-8 rounded-xl border border-border bg-surface-2 text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Dosage Form Selector */}
              <select
                value={selectedDosageForm}
                onChange={(e) => {
                  setSelectedDosageForm(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 rounded-xl border border-border bg-surface-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer"
              >
                <option value="">All Dosage Forms</option>
                {availableDosageForms.map((form) => (
                  <option key={form} value={form}>
                    {form}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  fetchDrugs();
                  fetchStats();
                }}
                disabled={isLoading}
                title="Refresh catalog"
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-surface-2 hover:bg-border text-text-secondary hover:text-text-primary transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-accent")} />
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-secondary">
              <div className="h-7 w-7 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
              <p className="text-xs">Loading Drug Master catalog...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-16 px-4 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-danger mx-auto" />
              <div className="text-sm font-semibold text-text-primary">{errorMsg}</div>
              <button
                onClick={() => fetchDrugs()}
                className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-medium cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : drugs.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-surface-2 flex items-center justify-center text-text-secondary mx-auto">
                <Pill className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-text-primary">No drug records found</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                {searchQuery || selectedDosageForm || activeTab !== "all"
                  ? "No medications matched your filter criteria. Try adjusting your search query or filters."
                  : "Your drug master catalog is empty. Click Import Master JSON to load initial records."}
              </p>
              {(searchQuery || selectedDosageForm || activeTab !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDosageForm("");
                    setActiveTab("all");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-text-secondary text-[11px] font-medium uppercase tracking-wider select-none">
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === drugs.length && drugs.length > 0}
                        onChange={selectAllCurrentPage}
                        className="rounded border-border cursor-pointer accent-accent"
                      />
                    </th>
                    <th className="py-3 px-3.5">Medicine & Active Ingredient</th>
                    <th className="py-3 px-3.5">Dosage & Form</th>
                    <th className="py-3 px-3.5">Packaging Unit</th>
                    <th className="py-3 px-3.5">Regulatory / Reg. Code</th>
                    <th className="py-3 px-3.5">Classification</th>
                    <th className="py-3 px-3.5 text-right">Regulated Price</th>
                    <th className="py-3 px-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {drugs.map((drug) => {
                    const isSelected = selectedIds.has(drug.id);
                    const isIncomplete = !drug.sfdaCode || !drug.nameAr || !drug.nameEn;

                    return (
                      <tr
                        key={drug.id}
                        className={cn(
                          "hover:bg-surface-2/40 transition-colors group",
                          isSelected && "bg-accent/5"
                        )}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(drug.id)}
                            className="rounded border-border cursor-pointer accent-accent"
                          />
                        </td>

                        {/* Medicine Names & Generic */}
                        <td className="py-3.5 px-3.5 max-w-[260px]">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-text-primary text-xs">
                                {drug.nameEn || drug.name}
                              </span>
                              {isIncomplete && (
                                <span
                                  title="Missing recommended regulatory fields"
                                  className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block"
                                />
                              )}
                            </div>

                            {drug.nameAr && (
                              <div
                                dir="rtl"
                                className="text-[11px] text-text-secondary font-medium tracking-normal text-right"
                              >
                                {drug.nameAr}
                              </div>
                            )}

                            {(drug.genericName || drug.strength) && (
                              <div className="text-[10px] text-text-secondary/80 flex items-center gap-1">
                                <span className="italic">{drug.genericName || "—"}</span>
                                {drug.strength && (
                                  <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-surface-2 border border-border">
                                    {drug.strength}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Dosage Form */}
                        <td className="py-3.5 px-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-surface-2 border border-border text-[11px] font-medium text-text-primary">
                            {drug.dosageForm || "TABLET"}
                          </span>
                        </td>

                        {/* Packaging Unit Conversion */}
                        <td className="py-3.5 px-3.5 text-text-secondary">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <span className="font-semibold text-text-primary">1 {drug.packageUnit || "BOX"}</span>
                            <span>=</span>
                            <span>{drug.unitsPerPack || 1} {drug.baseUnit || "UNIT"}</span>
                          </div>
                        </td>

                        {/* Regulatory Registration Code */}
                        <td className="py-3.5 px-3.5">
                          {drug.sfdaCode ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-text-primary group/code">
                              <span>{drug.sfdaCode}</span>
                              <button
                                onClick={() => handleCopyCode(drug.sfdaCode!)}
                                className="p-0.5 text-text-secondary hover:text-text-primary cursor-pointer"
                                title="Copy Regulatory Code"
                              >
                                {copiedCode === drug.sfdaCode ? (
                                  <Check className="h-2.5 w-2.5 text-success" />
                                ) : (
                                  <Copy className="h-2.5 w-2.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              <AlertTriangle className="h-3 w-3" /> Missing
                            </span>
                          )}
                        </td>

                        {/* Classification Badges */}
                        <td className="py-3.5 px-3.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {drug.isRx ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                Rx
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                                OTC
                              </span>
                            )}

                            {drug.isControlled && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <Lock className="h-2.5 w-2.5" /> Schedule
                              </span>
                            )}

                            {drug.isPriceRegulated && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                Price Regulated
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Public Regulated Price */}
                        <td className="py-3.5 px-3.5 text-right">
                          <div className="font-semibold text-text-primary text-xs">
                            {formatCurrency(Number(drug.publicPrice) || 0)}
                          </div>
                          <span className="text-[10px] text-text-secondary">per {drug.packageUnit || "pack"}</span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenDetails(drug)}
                              title="Inspect Active Batches & Inventory"
                              className="p-1.5 rounded-lg border border-border bg-surface-2 hover:bg-border text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditProduct(drug)}
                              title="Edit Drug Master Data"
                              className="p-1.5 rounded-lg border border-border bg-surface-2 hover:bg-accent/10 hover:border-accent/40 text-text-secondary hover:text-accent transition-all cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!isLoading && totalCount > 0 && (
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-secondary select-none">
              <div>
                Showing <span className="font-semibold text-text-primary">{(page - 1) * limit + 1}</span> to{" "}
                <span className="font-semibold text-text-primary">{Math.min(page * limit, totalCount)}</span> of{" "}
                <span className="font-semibold text-text-primary">{totalCount}</span> medications
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-2 hover:bg-border text-text-primary disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>

                <span className="px-2 font-medium">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-2 hover:bg-border text-text-primary disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Drawer: Batch Details Inspector */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {detailProduct && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailProduct(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-lg bg-surface border-l border-border h-full shadow-2xl flex flex-col z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-accent/10 text-accent uppercase">
                      Stock Lots & Batches
                    </span>
                    {detailProduct.isRx && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500">
                        Rx
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-text-primary leading-tight">
                    {detailProduct.nameEn || detailProduct.name}
                  </h2>
                  {detailProduct.nameAr && (
                    <p dir="rtl" className="text-xs text-text-secondary">
                      {detailProduct.nameAr}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setDetailProduct(null)}
                  className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6 text-xs">
                {/* Master Details Summary */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-2 border border-border">
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Generic Name</span>
                    <div className="font-semibold text-text-primary mt-0.5">
                      {detailProduct.genericName || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Strength</span>
                    <div className="font-semibold text-text-primary mt-0.5">
                      {detailProduct.strength || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Regulatory Code</span>
                    <div className="font-mono font-semibold text-text-primary mt-0.5">
                      {detailProduct.sfdaCode || "Not registered"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary uppercase">Pack Multi-Unit</span>
                    <div className="font-mono font-semibold text-text-primary mt-0.5">
                      1 {detailProduct.packageUnit} = {detailProduct.unitsPerPack} {detailProduct.baseUnit}
                    </div>
                  </div>
                </div>

                {/* Batches Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-text-primary flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-accent" />
                      Active FEFO Batches
                    </h3>
                    <span className="text-[11px] text-text-secondary">
                      {detailProduct.batches?.length || 0} lot(s) on record
                    </span>
                  </div>

                  {isLoadingDetail ? (
                    <div className="py-8 text-center text-text-secondary animate-pulse">
                      Loading batch records...
                    </div>
                  ) : !detailProduct.batches || detailProduct.batches.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-border text-center text-text-secondary space-y-2">
                      <p className="text-xs">No active batches recorded in local inventory for this item.</p>
                      <p className="text-[10px]">Batches are recorded automatically during GRN / Purchase Receiving.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailProduct.batches.map((batch) => {
                        const daysLeft = Math.ceil(
                          (new Date(batch.expiryDate).getTime() - nowMs) / (1000 * 60 * 60 * 24)
                        );
                        const isExpired = batch.status === "EXPIRED" || daysLeft <= 0;
                        const isNearExpiry = !isExpired && daysLeft <= 90;

                        return (
                          <div
                            key={batch.id}
                            className="p-3.5 rounded-xl border border-border bg-surface-2/60 flex items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-text-primary">
                                  {batch.batchNumber}
                                </span>
                                <span
                                  className={cn(
                                    "px-1.5 py-0.2 rounded text-[10px] font-bold uppercase",
                                    isExpired
                                      ? "bg-danger/10 text-danger"
                                      : isNearExpiry
                                      ? "bg-amber-500/10 text-amber-600"
                                      : "bg-success/10 text-success"
                                  )}
                                >
                                  {isExpired ? "Expired" : isNearExpiry ? `${daysLeft}d left` : "Healthy"}
                                </span>
                              </div>
                              <div className="text-[11px] text-text-secondary flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                <span>Expires: {formatDate(batch.expiryDate)}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-bold text-sm text-text-primary">
                                {batch.quantityInBaseUnits}{" "}
                                <span className="text-[10px] text-text-secondary font-normal uppercase">
                                  {detailProduct.baseUnit || "Units"}
                                </span>
                              </div>
                              <span className="text-[10px] text-text-secondary">
                                ≈ {(batch.quantityInBaseUnits / (detailProduct.unitsPerPack || 1)).toFixed(1)}{" "}
                                {detailProduct.packageUnit || "Boxes"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-border flex justify-end">
                <button
                  onClick={() => {
                    const toEdit = detailProduct;
                    setDetailProduct(null);
                    setEditProduct(toEdit);
                  }}
                  className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs hover:bg-accent-hover transition-all"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit Master Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Modal: Single Drug Master Edit */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editProduct && (
          <EditDrugModal
            product={editProduct}
            dosageForms={availableDosageForms}
            onClose={() => setEditProduct(null)}
            onSaved={(updated) => {
              setDrugs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
              setEditProduct(null);
              showToast(`Updated "${updated.nameEn || updated.name}" successfully`);
              fetchStats();
            }}
          />
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Modal: Bulk Edit Selected Rows */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isBulkEditOpen && (
          <BulkEditModal
            selectedCount={selectedIds.size}
            dosageForms={availableDosageForms}
            onClose={() => setIsBulkEditOpen(false)}
            onApply={async (changes) => {
              const rows = Array.from(selectedIds).map((id) => ({
                productId: id,
                ...changes,
              }));

              try {
                const res = await api.drugMaster.bulkImport(rows);
                showToast(`Bulk updated ${res.summary.ok} of ${rows.length} medications!`);
                setSelectedIds(new Set());
                setIsBulkEditOpen(false);
                fetchDrugs();
                fetchStats();
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Bulk update failed", "error");
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Modal: Bulk JSON Import */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isBulkImportOpen && (
          <BulkImportModal
            onClose={() => setIsBulkImportOpen(false)}
            onImportComplete={(res) => {
              showToast(
                `Bulk import finished: ${res.summary.ok} updated, ${res.summary.errors} errors, ${res.summary.notFound} not found.`
              );
              setIsBulkImportOpen(false);
              fetchDrugs();
              fetchStats();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Subcomponent: Single Drug Edit Modal
// ──────────────────────────────────────────────────────────────────────────

function EditDrugModal({
  product,
  dosageForms,
  onClose,
  onSaved,
}: {
  product: DrugMasterProduct;
  dosageForms: string[];
  onClose: () => void;
  onSaved: (p: DrugMasterProduct) => void;
}) {
  const [nameEn, setNameEn] = useState(product.nameEn || product.name || "");
  const [nameAr, setNameAr] = useState(product.nameAr || "");
  const [genericName, setGenericName] = useState(product.genericName || "");
  const [strength, setStrength] = useState(product.strength || "");
  const [sfdaCode, setSfdaCode] = useState(product.sfdaCode || "");
  const [dosageForm, setDosageForm] = useState(product.dosageForm || "TABLET");
  const [baseUnit, setBaseUnit] = useState(product.baseUnit || "TABLET");
  const [packageUnit, setPackageUnit] = useState(product.packageUnit || "BOX");
  const [unitsPerPack, setUnitsPerPack] = useState(product.unitsPerPack || 1);
  const [publicPrice, setPublicPrice] = useState(Number(product.publicPrice) || 0);

  const [isRx, setIsRx] = useState(product.isRx || false);
  const [isControlled, setIsControlled] = useState(product.isControlled || false);
  const [isPriceRegulated, setIsPriceRegulated] = useState(product.isPriceRegulated || false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const updated = await api.drugMaster.update(product.id, {
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        genericName: genericName.trim(),
        strength: strength.trim(),
        sfdaCode: sfdaCode.trim() || undefined,
        dosageForm,
        baseUnit,
        packageUnit,
        unitsPerPack: Number(unitsPerPack) || 1,
        publicPrice: Number(publicPrice) || 0,
        isRx,
        isControlled,
        isPriceRegulated,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update drug master record");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Pill className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Edit Drug Master Record</h2>
              <p className="text-xs text-text-secondary">Update classification, regulatory metadata & packaging</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bilingual Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-text-secondary uppercase">
                Trade Name (English) *
              </label>
              <input
                type="text"
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Panadol Extra 500mg"
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-text-secondary uppercase">
                Trade Name (Arabic)
              </label>
              <input
                type="text"
                dir="rtl"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: بنادول إكسترا ٥٠٠ مجم"
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface text-text-primary text-right focus:outline-none focus:ring-2 focus:ring-accent/30 font-medium"
              />
            </div>
          </div>

          {/* Generic, Strength & SFDA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-text-secondary uppercase">
                Generic Ingredient
              </label>
              <input
                type="text"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="e.g. Paracetamol + Caffeine"
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-text-secondary uppercase">
                Strength / Concentration
              </label>
              <input
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g. 500 mg / 65 mg"
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-text-secondary uppercase">
                Drug Registration / Regulatory Code
              </label>
              <input
                type="text"
                value={sfdaCode}
                onChange={(e) => setSfdaCode(e.target.value)}
                placeholder="e.g. NDC 0045-0449-01 or REG-19-847"
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          {/* Dosage & Packaging Conversions */}
          <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-4">
            <h4 className="font-semibold text-text-primary text-xs flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-accent" />
              Dosage Form & Multi-Unit Packaging
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-text-secondary uppercase">
                  Dosage Form
                </label>
                <select
                  value={dosageForm}
                  onChange={(e) => setDosageForm(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer"
                >
                  {dosageForms.map((df) => (
                    <option key={df} value={df}>
                      {df}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-text-secondary uppercase">
                  Package Unit
                </label>
                <select
                  value={packageUnit}
                  onChange={(e) => setPackageUnit(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer"
                >
                  {PACKAGE_UNITS.map((pu) => (
                    <option key={pu} value={pu}>
                      {pu}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-text-secondary uppercase">
                  Units Per Package
                </label>
                <input
                  type="number"
                  min="1"
                  value={unitsPerPack}
                  onChange={(e) => setUnitsPerPack(Math.max(1, Number(e.target.value)))}
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-text-secondary uppercase">
                  Base Unit
                </label>
                <select
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer"
                >
                  {BASE_UNITS.map((bu) => (
                    <option key={bu} value={bu}>
                      {bu}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[10px] text-text-secondary italic">
              Conversion: 1 {packageUnit} contains {unitsPerPack} {baseUnit}(s). All inventory stock is stored internally in base units for fractional dispensing.
            </p>
          </div>

          {/* Regulatory Flags & Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface hover:bg-surface-2 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isRx}
                onChange={(e) => setIsRx(e.target.checked)}
                className="rounded border-border accent-accent h-4 w-4"
              />
              <div>
                <div className="font-semibold text-text-primary text-xs">Prescription Required (Rx)</div>
                <div className="text-[10px] text-text-secondary">Requires registered doctor Rx</div>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface hover:bg-surface-2 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isControlled}
                onChange={(e) => setIsControlled(e.target.checked)}
                className="rounded border-border accent-accent h-4 w-4"
              />
              <div>
                <div className="font-semibold text-text-primary text-xs">Controlled Substance</div>
                <div className="text-[10px] text-text-secondary">Special MOH schedule tracking</div>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface hover:bg-surface-2 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isPriceRegulated}
                onChange={(e) => setIsPriceRegulated(e.target.checked)}
                className="rounded border-border accent-accent h-4 w-4"
              />
              <div>
                <div className="font-semibold text-text-primary text-xs">Price Regulated</div>
                <div className="text-[10px] text-text-secondary">Enforce official price ceiling</div>
              </div>
            </label>
          </div>

          {/* Public Regulated Price */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-text-secondary uppercase">
              Official Regulated Price Ceiling
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-semibold text-xs">
                {getTenantCurrency()}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={publicPrice}
                onChange={(e) => setPublicPrice(Number(e.target.value))}
                className="w-full h-9 pl-12 pr-3 rounded-xl border border-border bg-surface font-mono text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <span className="text-[10px] text-text-secondary">
              Maximum legal consumer price per {packageUnit} specified by health authority.
            </span>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-text-secondary hover:text-text-primary cursor-pointer text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-xs cursor-pointer shadow-xs hover:bg-accent-hover transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Subcomponent: Bulk Edit Modal
// ──────────────────────────────────────────────────────────────────────────

function BulkEditModal({
  selectedCount,
  dosageForms,
  onClose,
  onApply,
}: {
  selectedCount: number;
  dosageForms: string[];
  onClose: () => void;
  onApply: (changes: Record<string, unknown>) => Promise<void>;
}) {
  const [isRx, setIsRx] = useState<string>("keep");
  const [isControlled, setIsControlled] = useState<string>("keep");
  const [isPriceRegulated, setIsPriceRegulated] = useState<string>("keep");
  const [dosageForm, setDosageForm] = useState<string>("keep");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const changes: Record<string, unknown> = {};
    if (isRx !== "keep") changes.isRx = isRx === "yes";
    if (isControlled !== "keep") changes.isControlled = isControlled === "yes";
    if (isPriceRegulated !== "keep") changes.isPriceRegulated = isPriceRegulated === "yes";
    if (dosageForm !== "keep") changes.dosageForm = dosageForm;

    await onApply(changes);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">Bulk Edit Medications</h2>
            <p className="text-xs text-text-secondary">
              Apply common attributes to <span className="font-semibold text-accent">{selectedCount}</span> selected items
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-text-secondary uppercase">
              Prescription Requirement (Rx)
            </label>
            <select
              value={isRx}
              onChange={(e) => setIsRx(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface text-text-primary"
            >
              <option value="keep">— Keep Unchanged —</option>
              <option value="yes">Mark as Prescription Required (Rx = True)</option>
              <option value="no">Mark as Over-the-Counter (OTC = False)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-text-secondary uppercase">
              Controlled Substance Status
            </label>
            <select
              value={isControlled}
              onChange={(e) => setIsControlled(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface text-text-primary"
            >
              <option value="keep">— Keep Unchanged —</option>
              <option value="yes">Mark as Controlled Substance (Schedule)</option>
              <option value="no">Mark as Standard / Not Controlled</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-text-secondary uppercase">
              Price Regulation (Official Ceiling)
            </label>
            <select
              value={isPriceRegulated}
              onChange={(e) => setIsPriceRegulated(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface text-text-primary"
            >
              <option value="keep">— Keep Unchanged —</option>
              <option value="yes">Mark as Price Regulated</option>
              <option value="no">Mark as Free Market Pricing</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-text-secondary uppercase">
              Dosage Form
            </label>
            <select
              value={dosageForm}
              onChange={(e) => setDosageForm(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-surface text-text-primary"
            >
              <option value="keep">— Keep Unchanged —</option>
              {dosageForms.map((df) => (
                <option key={df} value={df}>
                  {df}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-text-secondary hover:text-text-primary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-accent text-accent-foreground font-semibold cursor-pointer shadow-xs hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Updating..." : `Apply to ${selectedCount} Items`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Subcomponent: Bulk JSON Import Modal
// ──────────────────────────────────────────────────────────────────────────

function BulkImportModal({
  onClose,
  onImportComplete,
}: {
  onClose: () => void;
  onImportComplete: (res: BulkImportResult) => void;
}) {
  const [jsonText, setJsonText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const sampleTemplate = `[
  {
    "productId": "00000000-0000-0000-0000-000000000000",
    "nameEn": "Panadol Advance 500mg",
    "nameAr": "بنادول أدفانس ٥٠٠ مجم",
    "genericName": "Paracetamol",
    "dosageForm": "TABLET",
    "strength": "500 mg",
    "sfdaCode": "19-123-2024",
    "isRx": false,
    "isControlled": false,
    "isPriceRegulated": true,
    "publicPrice": 12.50,
    "baseUnit": "TABLET",
    "packageUnit": "BOX",
    "unitsPerPack": 24
  }
]`;

  const handleImport = async () => {
    setParseError(null);
    if (!jsonText.trim()) {
      setParseError("Please enter JSON array payload");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setParseError("Invalid JSON syntax. Please verify quotes and commas.");
      return;
    }

    if (!Array.isArray(parsed)) {
      setParseError("Payload must be a JSON array of objects.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.drugMaster.bulkImport(parsed);
      onImportComplete(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">Bulk Import Drug Master JSON</h2>
            <p className="text-xs text-text-secondary">
              Update existing products in batch by Product UUID with registration codes and multilingual names
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {parseError && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-semibold text-text-primary">Paste JSON Payload</span>
            <button
              type="button"
              onClick={() => setJsonText(sampleTemplate)}
              className="text-[11px] text-accent hover:underline cursor-pointer flex items-center gap-1"
            >
              <Copy className="h-3 w-3" /> Load Sample Schema
            </button>
          </div>

          <textarea
            rows={10}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Paste your JSON array here..."
            className="w-full p-3 font-mono text-xs rounded-xl border border-border bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          />

          <div className="p-3 rounded-xl bg-accent/5 border border-accent/15 text-[11px] text-text-secondary space-y-1">
            <p className="font-semibold text-text-primary">Regulatory Catalog Note:</p>
            <p>
              Each row must include a valid <code className="font-mono text-accent">productId</code> matching an existing catalog item in your pharmacy. Unmatched IDs will be flagged in the report.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-text-secondary hover:text-text-primary cursor-pointer text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-xs cursor-pointer shadow-xs hover:bg-accent-hover transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? "Importing..." : "Execute Bulk Import"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
