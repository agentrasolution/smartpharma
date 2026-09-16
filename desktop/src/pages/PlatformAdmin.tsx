import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Building2, CheckCircle2, AlertTriangle, Wallet, RefreshCw,
  Search, CalendarClock, Settings2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import type { Pharmacy, SubscriptionInfo } from "@/types";

type SubStatus = "active" | "trial" | "past_due" | "cancelled" | "expired";

const STATUS_TONES: Record<string, "success" | "danger" | "warning" | "default" | "neutral" | "outline"> = {
  active: "success",
  trial: "default",
  past_due: "warning",
  cancelled: "neutral",
  expired: "danger",
};

const STATUS_LABELS: Record<SubStatus, string> = {
  active: "Active",
  trial: "Trial",
  past_due: "Past Due",
  cancelled: "Cancelled",
  expired: "Expired",
};

interface ManageState {
  pharmacy: Pharmacy;
  status: SubStatus;
  price: string;
  extendMonths: string;
  renewsAt: string;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PlatformAdmin() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | SubStatus>("all");
  const [manage, setManage] = useState<ManageState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(silent);
    try {
      const data = await api.pharmacy.adminList();
      setPharmacies(data);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pharmacies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = pharmacies.length;
    const byStatus: Record<string, number> = {};
    let mrr = 0;
    let activeBranches = 0;
    let activeUsers = 0;
    let activeProducts = 0;
    for (const p of pharmacies) {
      const st = p.subscription?.status ?? "none";
      byStatus[st] = (byStatus[st] ?? 0) + 1;
      if (st === "active" || st === "trial") mrr += p.subscription?.price ?? 0;
      activeBranches += p.counts?.branches ?? 0;
      activeUsers += p.counts?.users ?? 0;
      activeProducts += p.counts?.products ?? 0;
    }
    return {
      total,
      active: byStatus.active ?? 0,
      trial: byStatus.trial ?? 0,
      attention: (byStatus.past_due ?? 0) + (byStatus.expired ?? 0) + (byStatus.cancelled ?? 0),
      mrr,
      branches: activeBranches,
      users: activeUsers,
      products: activeProducts,
    };
  }, [pharmacies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pharmacies.filter((p) => {
      if (filter !== "all" && (p.subscription?.status ?? "none") !== filter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.contact.toLowerCase().includes(q)
      );
    });
  }, [pharmacies, search, filter]);

  const statusCounts = useMemo(() => {
    const counts: Record<"all" | SubStatus, number> = {
      all: pharmacies.length,
      active: 0,
      trial: 0,
      past_due: 0,
      cancelled: 0,
      expired: 0,
    };
    for (const p of pharmacies) {
      const st = (p.subscription?.status ?? "none") as SubStatus | "none";
      if (st !== "none") counts[st] += 1;
    }
    return counts;
  }, [pharmacies]);

  const openManage = useCallback((p: Pharmacy) => {
    setManage({
      pharmacy: p,
      status: (p.subscription?.status as SubStatus) ?? "active",
      price: p.subscription?.price != null ? String(p.subscription.price) : "5000",
      extendMonths: "",
      renewsAt: p.subscription?.renewsAt ? p.subscription.renewsAt.slice(0, 10) : "",
    });
  }, []);

  const saveSubscription = useCallback(async () => {
    if (!manage) return;
    setSaving(true);
    try {
      const payload: Partial<SubscriptionInfo> & { extendMonths?: number } = {
        status: manage.status,
      };
      if (manage.price) {
        const price = Number(manage.price);
        if (!Number.isFinite(price) || price < 0) {
          toast.error("Enter a valid price");
          return;
        }
        payload.price = price;
      }
      if (manage.extendMonths) {
        const months = Number(manage.extendMonths);
        if (!Number.isInteger(months) || months < 1 || months > 24) {
          toast.error("Extend months must be 1–24");
          return;
        }
        payload.extendMonths = months;
      }
      if (manage.renewsAt) {
        payload.renewsAt = new Date(`${manage.renewsAt}T00:00:00.000Z`).toISOString();
      }
      const sub = await api.pharmacy.adminUpdateSubscription(manage.pharmacy.id, payload);
      toast.success(`${manage.pharmacy.name} subscription updated to ${STATUS_LABELS[manage.status] ?? manage.status}`);
      setManage((prev) =>
        prev
          ? {
              ...prev,
              pharmacy: { ...prev.pharmacy, subscription: { ...prev.pharmacy.subscription, ...sub } },
            }
          : null
      );
      setPharmacies((prev) =>
        prev.map((p) =>
          p.id === manage.pharmacy.id
            ? { ...p, subscription: { ...p.subscription, ...sub } }
            : p
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update subscription");
    } finally {
      setSaving(false);
    }
  }, [manage]);

  const filterTabs: { key: "all" | SubStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "trial", label: "Trial" },
    { key: "past_due", label: "Past Due" },
    { key: "cancelled", label: "Cancelled" },
    { key: "expired", label: "Expired" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-text-primary tracking-tight">Platform Admin</h1>
          <p className="text-xs text-text-secondary">
            Registered pharmacies and their subscription billing records
            {lastUpdated ? (
              <span className="text-text-secondary/70">
                {" "}· Updated {lastUpdated.toLocaleTimeString()}
              </span>
            ) : null}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Registered Pharmacies"
          value={stats.total}
          icon={<Building2 className="h-4 w-4" />}
          subtitle={`${stats.branches} branches · ${stats.users} users · ${stats.products} products`}
          loading={loading}
        />
        <StatCard
          title="Active Subscriptions"
          value={stats.active}
          icon={<CheckCircle2 className="h-4 w-4" />}
          subtitle={`${stats.trial} on trial`}
          loading={loading}
        />
        <StatCard
          title="Needs Attention"
          value={stats.attention}
          icon={<AlertTriangle className="h-4 w-4" />}
          subtitle="Past due, cancelled or expired"
          loading={loading}
        />
        <StatCard
          title="Monthly Recurring Revenue"
          value={stats.mrr}
          icon={<Wallet className="h-4 w-4" />}
          subtitle="Active + trial subscriptions"
          loading={loading}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pharmacy, slug, email or phone…"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterTabs.map((tab) => {
              const active = filter === tab.key;
              const count = statusCounts[tab.key];
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 text-[10px] tabular-nums ${active ? "opacity-80" : "text-text-secondary/60"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-surface-2 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No pharmacies found"
            description="No registered pharmacies match the current filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pharmacy</TableHead>
                  <TableHead className="text-right">Branches</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Price / mo</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, idx) => {
                  const status = p.subscription?.status ?? "none";
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.2 }}
                      className="group border-b border-border transition-colors hover:bg-surface-2/40"
                    >
                      <TableCell className="min-w-[220px]">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-text-primary truncate">{p.name}</p>
                            <p className="text-[10px] text-text-secondary truncate">
                              {p.email || p.phone || `@${p.slug}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-text-secondary tabular-nums">
                        {p.counts?.branches ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-xs text-text-secondary tabular-nums">
                        {p.counts?.users ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-xs text-text-secondary tabular-nums">
                        {p.counts?.products ?? 0}
                      </TableCell>
                      <TableCell className="text-xs text-text-primary capitalize">
                        {p.subscription?.plan ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-text-primary tabular-nums">
                        {p.subscription?.price != null ? formatCurrency(p.subscription.price) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3 w-3 text-text-secondary/50" />
                          {formatDate(p.subscription?.renewsAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_TONES[status] ?? "outline"}>
                          {status === "none" ? "No Subscription" : STATUS_LABELS[status as SubStatus] ?? status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openManage(p)} className="gap-1">
                          <Settings2 className="h-3 w-3" />
                          Manage
                        </Button>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={!!manage} onOpenChange={(v) => { if (!v) setManage(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Manage Subscription</DialogTitle>
          </DialogHeader>
          {manage && (
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-text-primary">{manage.pharmacy.name}</p>
                <p className="text-[10px] text-text-secondary">
                  Registered {formatDate(manage.pharmacy.createdAt)} · {manage.pharmacy.counts?.branches ?? 0} branches ·{" "}
                  {manage.pharmacy.counts?.users ?? 0} users
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-text-secondary">Subscription Status</Label>
                <Select
                  value={manage.status}
                  onValueChange={(v) => setManage((prev) => prev ? { ...prev, status: v as SubStatus } : prev)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as SubStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="inline-flex items-center gap-2">
                          <Badge variant={STATUS_TONES[s]}>{STATUS_LABELS[s]}</Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-text-secondary">Monthly Price (PKR)</Label>
                  <Input
                    value={manage.price}
                    onChange={(e) => setManage((prev) => prev ? { ...prev, price: e.target.value } : prev)}
                    placeholder="5000"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-text-secondary">Extend By (months)</Label>
                  <Input
                    value={manage.extendMonths}
                    onChange={(e) => setManage((prev) => prev ? { ...prev, extendMonths: e.target.value } : prev)}
                    placeholder="1–24"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-text-secondary">Renews On</Label>
                <Input
                  type="date"
                  value={manage.renewsAt}
                  onChange={(e) => setManage((prev) => prev ? { ...prev, renewsAt: e.target.value } : prev)}
                />
              </div>

              <p className="text-[10px] text-text-secondary leading-relaxed rounded-lg bg-surface-2 px-2.5 py-2">
                Setting a status to <span className="font-medium">expired</span> immediately blocks the pharmacy's data
                access (HTTP 402). Use <span className="font-medium">Extend By</span> to add months to the current
                renewal date.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManage(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveSubscription()} disabled={saving} className="gap-1.5">
              {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Save Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}