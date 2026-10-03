import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package, AlertTriangle, Activity, Plus, RefreshCw,
  FlaskConical, Layers, Search, ChevronRight, TrendingDown,
  TrendingUp, Ban, RotateCcw, Wrench, Filter, Clock,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatCard from "@/components/shared/StatCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityInBaseUnits: number;
  costPricePerUnit: number | string;
  salePricePerUnit: number | string;
  status: string;
  isRecalled: boolean;
  gtin?: string;
  product?: { id: string; name: string; genericName?: string; dosageForm?: string; baseUnit?: string };
  branch?: { id: string; name: string };
}

interface Movement {
  id: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  unitCost: number | string;
  referenceNumber?: string;
  reasonCode?: string;
  createdAt: string;
  product?: { id: string; name: string };
  batch?: { id: string; batchNumber: string; expiryDate: string };
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function daysUntilExpiry(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function expiryBadge(dateStr: string) {
  const days = daysUntilExpiry(dateStr);
  if (days < 0) return <Badge variant="outline" className="bg-danger/10 text-danger border-danger/30 font-mono text-[11px] font-semibold">Expired</Badge>;
  if (days <= 30) return <Badge variant="outline" className="bg-danger/10 text-danger border-danger/30 font-mono text-[11px] font-semibold">{days}d left</Badge>;
  if (days <= 90) return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 font-mono text-[11px] font-semibold">{days}d left</Badge>;
  return <Badge variant="outline" className="bg-success/10 text-success border-success/30 font-mono text-[11px] font-semibold">{days}d</Badge>;
}

function statusBadge(status: string, isRecalled: boolean) {
  if (isRecalled) return <Badge variant="outline" className="bg-danger/10 text-danger border-danger/30 font-semibold text-[11px]">Recalled</Badge>;
  const map: Record<string, string> = {
    ACTIVE: "bg-success/10 text-success border-success/30",
    DEPLETED: "bg-surface-2 text-text-secondary border-border/80",
    QUARANTINED: "bg-warning/10 text-warning border-warning/30",
    RECALLED: "bg-danger/10 text-danger border-danger/30",
    EXPIRED: "bg-danger/10 text-danger border-danger/30",
  };
  return <Badge variant="outline" className={`font-semibold text-[11px] ${map[status] ?? "bg-surface-2 text-text-secondary border-border/80"}`}>{status}</Badge>;
}

function movementIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    PURCHASE_RECEIPT: <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />,
    SALE: <TrendingDown className="h-3.5 w-3.5 text-blue-600" />,
    RETURN_IN: <RotateCcw className="h-3.5 w-3.5 text-violet-600" />,
    RETURN_OUT: <RotateCcw className="h-3.5 w-3.5 text-orange-600" />,
    ADJUSTMENT: <Wrench className="h-3.5 w-3.5 text-slate-500" />,
    EXPIRED_DISCARD: <Ban className="h-3.5 w-3.5 text-red-500" />,
  };
  return icons[type] ?? <Activity className="h-3.5 w-3.5 text-slate-400" />;
}

// --------------------------------------------------------------------------
// Receive Batch Dialog
// --------------------------------------------------------------------------

function ReceiveBatchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    productId: "", batchNumber: "", expiryDate: "",
    quantityInBaseUnits: "", costPricePerUnit: "", salePricePerUnit: "", gtin: "",
  });

  const { data: productList } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.list({ pageSize: 2000 }),
  });
  const products = (productList as any)?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => api.inventory.batches.receive({
      productId: form.productId,
      batchNumber: form.batchNumber,
      expiryDate: form.expiryDate,
      quantityInBaseUnits: Number(form.quantityInBaseUnits),
      costPricePerUnit: Number(form.costPricePerUnit),
      salePricePerUnit: Number(form.salePricePerUnit),
      gtin: form.gtin || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["inventory-expiring"] });
      toast.success("Batch received and stock updated");
      onClose();
      setForm({ productId: "", batchNumber: "", expiryDate: "", quantityInBaseUnits: "", costPricePerUnit: "", salePricePerUnit: "", gtin: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const valid = form.productId && form.batchNumber && form.expiryDate &&
    Number(form.quantityInBaseUnits) > 0 && Number(form.costPricePerUnit) >= 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            Receive New Batch (GRN)
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-1.5">
            <Label>Product *</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-surface text-sm px-3 focus:outline-none focus:ring-2 focus:ring-accent/30"
              value={form.productId}
              onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
            >
              <option value="">Select product…</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Batch / Lot Number *</Label>
            <Input placeholder="e.g. LOT-2025-001" value={form.batchNumber} onChange={f("batchNumber")} />
          </div>
          <div className="space-y-1.5">
            <Label>Expiry Date *</Label>
            <Input type="date" value={form.expiryDate} onChange={f("expiryDate")} />
          </div>

          <div className="space-y-1.5">
            <Label>Qty (base units) *</Label>
            <Input type="number" min="1" placeholder="e.g. 1000 tablets" value={form.quantityInBaseUnits} onChange={f("quantityInBaseUnits")} />
          </div>
          <div className="space-y-1.5">
            <Label>GS1 GTIN (optional)</Label>
            <Input placeholder="14-digit GTIN" value={form.gtin} onChange={f("gtin")} />
          </div>

          <div className="space-y-1.5">
            <Label>Cost / base unit (SAR) *</Label>
            <Input type="number" min="0" step="0.001" placeholder="0.000" value={form.costPricePerUnit} onChange={f("costPricePerUnit")} />
          </div>
          <div className="space-y-1.5">
            <Label>Sale price / base unit (SAR)</Label>
            <Input type="number" min="0" step="0.001" placeholder="0.000" value={form.salePricePerUnit} onChange={f("salePricePerUnit")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Receiving…" : "Receive Batch"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Adjust Dialog
// --------------------------------------------------------------------------

function AdjustDialog({ batch, onClose }: { batch: Batch | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState("");
  const [reasonCode, setReasonCode] = useState("ADJUSTMENT");
  const [ref, setRef] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.inventory.batches.adjust(batch!.id, {
      deltaUnits: Number(delta),
      reasonCode,
      referenceNumber: ref || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      toast.success("Batch adjusted");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!batch} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust Batch — {batch?.batchNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-surface-2 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-text-secondary">Product</span><span className="font-medium">{batch?.product?.name}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Current qty</span><span className="font-medium">{batch?.quantityInBaseUnits} {batch?.product?.baseUnit ?? "units"}</span></div>
          </div>
          <div className="space-y-1.5">
            <Label>Delta (+ add / − remove)</Label>
            <Input type="number" placeholder="e.g. -10 or +50" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["ADJUSTMENT", "EXPIRED_DISCARD", "RETURN_IN", "TRANSFER_IN", "TRANSFER_OUT", "DAMAGE"].map((r) => (
                  <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference (optional)</Label>
            <Input placeholder="e.g. adjustment note" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!delta || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Apply Adjustment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Main Page
// --------------------------------------------------------------------------

export default function Inventory() {
  const [tab, setTab] = useState("batches");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustBatch, setAdjustBatch] = useState<Batch | null>(null);
  const [movementPage, setMovementPage] = useState(1);

  // Queries
  const { data: batches = [], isLoading: batchLoading, refetch: refetchBatches } = useQuery({
    queryKey: ["inventory-batches", statusFilter],
    queryFn: () => api.inventory.batches.list({ status: statusFilter || undefined }) as Promise<Batch[]>,
  });

  const { data: expiring = [], isLoading: expiryLoading } = useQuery({
    queryKey: ["inventory-expiring"],
    queryFn: () => api.inventory.batches.expiringSoon(90) as Promise<Batch[]>,
  });

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ["inventory-movements", movementPage],
    queryFn: () => api.inventory.movements.list({ page: movementPage, limit: 50 }),
    placeholderData: (prev) => prev,
  });

  const movements = (movementsData?.data ?? []) as Movement[];
  const movementsMeta = movementsData?.meta ?? { total: 0, page: 1, pages: 1 };

  // Expiry scan mutation
  const scanMutation = useMutation({
    mutationFn: () => api.inventory.expiringScan(),
    onSuccess: (s) => {
      toast.success(`Scan complete — ${s.expiredMarked} expired, ${s.nearExpiryAlerts} near-expiry alerts`);
      refetchBatches();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Filtered batches
  const filtered = batches.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.batchNumber.toLowerCase().includes(q) ||
      b.product?.name?.toLowerCase().includes(q) ||
      b.product?.genericName?.toLowerCase().includes(q) ||
      b.gtin?.toLowerCase().includes(q)
    );
  });

  // Summary stats
  const activeBatches = batches.filter((b) => b.status === "ACTIVE" && !b.isRecalled).length;
  const nearExpiry = expiring.length;
  const recalledBatches = batches.filter((b) => b.isRecalled).length;
  const totalUnits = batches.filter((b) => b.status === "ACTIVE").reduce((s, b) => s + b.quantityInBaseUnits, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch & Inventory Management"
        description="FEFO lot tracking, shelf-life lifecycle, expiry alarms, and audit movement ledger."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-accent/10 text-accent font-semibold border border-accent/20">
            {activeBatches} Active Batches
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanMutation.isPending ? "animate-spin" : ""}`} />
              Run Expiry Scan
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-xl text-xs gap-1.5 font-medium shadow-xs"
              onClick={() => setReceiveOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Receive Batch
            </Button>
          </div>
        }
      />

      {/* ---- Summary StatCards ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Batches"
          value={activeBatches}
          icon={<Layers className="h-5 w-5" />}
          color="success"
          subtitle="In-circulation batches"
        />
        <StatCard
          title="Near Expiry (90d)"
          value={nearExpiry}
          icon={<Clock className="h-5 w-5" />}
          color="warning"
          subtitle="Expiring within 90 days"
        />
        <StatCard
          title="Recalled / Hold"
          value={recalledBatches}
          icon={<Ban className="h-5 w-5" />}
          color="danger"
          subtitle="Flagged or quarantined"
        />
        <StatCard
          title="Total Active Units"
          value={totalUnits}
          icon={<Package className="h-5 w-5" />}
          color="accent"
          subtitle="Base units inventory"
        />
      </div>

      {/* ---- Near-expiry alert banner ---- */}
      {nearExpiry > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-text-primary">
              <strong className="text-warning font-semibold">{nearExpiry} batch{nearExpiry > 1 ? "es" : ""}</strong> expiring within 90 days.
              Review lots for prioritized FEFO dispensing or vendor return.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl text-xs border-warning/30 hover:bg-warning/10 shrink-0"
            onClick={() => setTab("expiring")}
          >
            Review Expiring Lots
          </Button>
        </div>
      )}

      {/* ---- Tabs ---- */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-surface-2/80 p-1 rounded-xl border border-border/80">
          <TabsTrigger value="batches" className="gap-1.5 text-xs rounded-lg">
            <Layers className="h-3.5 w-3.5" /> Batches
          </TabsTrigger>
          <TabsTrigger value="expiring" className="gap-1.5 text-xs rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            Near Expiry
            {nearExpiry > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2">
                {nearExpiry > 99 ? "99+" : nearExpiry}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5 text-xs rounded-lg">
            <Activity className="h-3.5 w-3.5" /> Movement Ledger
          </TabsTrigger>
        </TabsList>

        {/* ---- Batches Tab ---- */}
        <TabsContent value="batches" className="space-y-4 mt-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-border/80 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <Input
                className="pl-9 h-9 rounded-xl text-xs bg-surface-2/40 border-border/80 focus:bg-surface"
                placeholder="Search batch number, product, GTIN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-text-secondary" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 rounded-xl text-xs border-border/80">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DEPLETED">Depleted</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="RECALLED">Recalled</SelectItem>
                  <SelectItem value="QUARANTINED">Quarantined</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-text-secondary ml-2 font-mono">
                {filtered.length} batch{filtered.length !== 1 ? "es" : ""}
              </span>
            </div>
          </div>

          <DataTable<Batch>
            loading={batchLoading}
            data={filtered}
            keyExtractor={(b) => b.id}
            emptyTitle="No inventory batches found"
            emptyDescription={search ? `No batches matched "${search}".` : "Receive a new batch to register stock into the inventory."}
            emptyAction={
              <Button onClick={() => setReceiveOpen(true)} size="sm" className="h-9 rounded-xl text-xs gap-1.5 font-medium shadow-xs">
                <Plus className="h-3.5 w-3.5" /> Receive First Batch
              </Button>
            }
            columns={[
              {
                key: "product",
                header: "Product",
                cell: (b) => (
                  <div>
                    <p className="font-medium text-sm">{b.product?.name ?? "—"}</p>
                    {b.product?.genericName && (
                      <p className="text-xs text-text-secondary">{b.product.genericName} · {b.product.dosageForm}</p>
                    )}
                  </div>
                ),
              },
              {
                key: "batch",
                header: "Batch / GTIN",
                cell: (b) => (
                  <div>
                    <p className="text-sm font-mono font-medium">{b.batchNumber}</p>
                    {b.gtin && <p className="text-xs text-text-secondary font-mono">{b.gtin}</p>}
                  </div>
                ),
              },
              {
                key: "expiry",
                header: "Expiry",
                cell: (b) => (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatDate(b.expiryDate)}</span>
                    {expiryBadge(b.expiryDate)}
                  </div>
                ),
              },
              {
                key: "qty",
                header: "Qty (base units)",
                cell: (b) => (
                  <span className={`text-sm font-semibold tabular-nums ${b.quantityInBaseUnits === 0 ? "text-text-secondary" : ""}`}>
                    {b.quantityInBaseUnits.toLocaleString()}
                    <span className="text-xs font-normal text-text-secondary ml-1">{b.product?.baseUnit ?? "units"}</span>
                  </span>
                ),
              },
              {
                key: "cost",
                header: "Cost / unit",
                cell: (b) => <span className="text-sm tabular-nums">{formatCurrency(Number(b.costPricePerUnit))}</span>,
              },
              {
                key: "status",
                header: "Status",
                cell: (b) => statusBadge(b.status, b.isRecalled),
              },
              {
                key: "actions",
                header: "",
                cell: (b) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setAdjustBatch(b)}
                    disabled={b.status !== "ACTIVE" || b.isRecalled}
                  >
                    <Wrench className="h-3 w-3" />
                    Adjust
                  </Button>
                ),
              },
            ]}
          />
        </TabsContent>

        {/* ---- Near Expiry Tab ---- */}
        <TabsContent value="expiring" className="mt-4">
          <DataTable<Batch>
            loading={expiryLoading}
            data={expiring as Batch[]}
            keyExtractor={(b) => b.id}
            emptyMessage="No batches expiring within 90 days. All clear! ✓"
            columns={[
              {
                key: "urgency",
                header: "Urgency",
                cell: (b) => expiryBadge(b.expiryDate),
              },
              {
                key: "product",
                header: "Product",
                cell: (b) => (
                  <div>
                    <p className="font-medium text-sm">{b.product?.name ?? "—"}</p>
                    <p className="text-xs text-text-secondary">{b.product?.genericName}</p>
                  </div>
                ),
              },
              {
                key: "batch",
                header: "Batch",
                cell: (b) => <span className="font-mono text-sm">{b.batchNumber}</span>,
              },
              {
                key: "expiry",
                header: "Expiry Date",
                cell: (b) => <span className="text-sm">{formatDate(b.expiryDate)}</span>,
              },
              {
                key: "qty",
                header: "Remaining",
                cell: (b) => (
                  <span className="text-sm font-semibold tabular-nums text-amber-700">
                    {b.quantityInBaseUnits.toLocaleString()} {b.product?.baseUnit ?? "units"}
                  </span>
                ),
              },
              {
                key: "branch",
                header: "Branch",
                cell: (b) => <span className="text-sm">{b.branch?.name ?? "—"}</span>,
              },
              {
                key: "action",
                header: "",
                cell: (b) => (
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAdjustBatch(b)}>
                    <Wrench className="h-3 w-3" />
                    Discard
                  </Button>
                ),
              },
            ]}
          />
        </TabsContent>

        {/* ---- Movement Ledger Tab ---- */}
        <TabsContent value="movements" className="space-y-4 mt-0">
          <DataTable<Movement>
            loading={movementsLoading}
            data={movements}
            keyExtractor={(m) => m.id}
            emptyTitle="No stock movements recorded"
            emptyDescription="Stock receipts, adjustments, returns, and dispensing events will be recorded here in real-time."
            page={movementPage}
            totalPages={movementsMeta.pages}
            totalCount={movementsMeta.total}
            onPageChange={setMovementPage}
            itemLabel="movements"
            columns={[
              {
                key: "type",
                header: "Type",
                cell: (m) => (
                  <div className="flex items-center gap-1.5">
                    {movementIcon(m.movementType)}
                    <span className="text-xs font-medium">{m.movementType.replace(/_/g, " ")}</span>
                  </div>
                ),
              },
              {
                key: "product",
                header: "Product",
                cell: (m) => <span className="text-sm">{m.product?.name ?? "—"}</span>,
              },
              {
                key: "batch",
                header: "Batch",
                cell: (m) => (
                  <span className="font-mono text-xs">
                    {m.batch?.batchNumber ?? <span className="text-text-secondary">—</span>}
                  </span>
                ),
              },
              {
                key: "delta",
                header: "Δ Units",
                cell: (m) => (
                  <span className={`text-sm font-semibold tabular-nums ${m.quantityDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta.toLocaleString()}
                  </span>
                ),
              },
              {
                key: "balance",
                header: "Balance After",
                cell: (m) => <span className="text-sm tabular-nums">{m.balanceAfter.toLocaleString()}</span>,
              },
              {
                key: "ref",
                header: "Reference",
                cell: (m) => <span className="text-xs text-text-secondary font-mono">{m.referenceNumber ?? "—"}</span>,
              },
              {
                key: "date",
                header: "Date",
                cell: (m) => <span className="text-xs text-text-secondary">{formatDate(m.createdAt)}</span>,
              },
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* ---- Dialogs ---- */}
      <ReceiveBatchDialog open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      <AdjustDialog batch={adjustBatch} onClose={() => setAdjustBatch(null)} />
    </div>
  );
}
