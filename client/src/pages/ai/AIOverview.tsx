import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, Activity, Package, CheckCircle, Boxes, RefreshCw, Clock, BrainCircuit,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import RiskBadge from "@/components/shared/RiskBadge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { AIReorderCandidate } from "@/types";

export default function AIOverview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: summary = { totalProducts: 0, critical: 0, high: 0, medium: 0, healthy: 0, overstock: 0 }, isLoading } = useQuery({
    queryKey: ["ai-summary"],
    queryFn: () => api.ai.inventory.summary(30),
  });

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["ai-reorder-candidates"],
    queryFn: () => api.ai.inventory.reorderCandidates(30),
  });

  const runMutation = useMutation({
    mutationFn: () => api.ai.recommendations.run(30),
    onSuccess: (res) => {
      toast.success(`Recommendations generated: ${res.created}`);
      queryClient.invalidateQueries({ queryKey: ["ai-summary"] });
      queryClient.invalidateQueries({ queryKey: ["ai-reorder-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["ai-recommendations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns = [
    { key: "name", header: "Product", cell: (r: AIReorderCandidate) => (
      <div>
        <span className="font-medium text-text-primary">{r.name}</span>
        <span className="block text-[10px] font-mono text-text-secondary">{r.barcode}</span>
      </div>
    ) },
    { key: "current", header: "In Stock", cell: (r: AIReorderCandidate) => (
      <span className="font-mono">{r.currentStock}</span>
    ) },
    { key: "reorderPoint", header: "Reorder Pt.", cell: (r: AIReorderCandidate) => (
      <span className="font-mono text-text-secondary">{r.reorderPoint}</span>
    ) },
    { key: "avgDaily", header: "Daily Sales", cell: (r: AIReorderCandidate) => (
      <span className="font-mono">{r.averageDailySales.toFixed(1)}</span>
    ) },
    { key: "coverage", header: "Coverage", cell: (r: AIReorderCandidate) => (
      <span className="font-mono text-text-secondary">{r.stockCoverageDays != null ? `${r.stockCoverageDays}d` : "—"}</span>
    ) },
    { key: "lead", header: "Lead Time", cell: (r: AIReorderCandidate) => (
      <span className="font-mono text-text-secondary">{r.leadTimeDays != null ? `${r.leadTimeDays}d` : "—"}</span>
    ) },
    { key: "risk", header: "Risk", cell: (r: AIReorderCandidate) => <RiskBadge risk={r.riskLevel} /> },
    { key: "recommended", header: "Recommended", cell: (r: AIReorderCandidate) => (
      <span className="font-mono font-semibold text-accent">{r.recommendedQuantity} <span className="text-[10px] text-text-secondary font-normal">({r.recommendedQuantityPacked} pk)</span></span>
    ) },
  ];

  const tiles = [
    { title: "Total Products", value: summary.totalProducts, icon: <Package className="h-4 w-4" /> },
    { title: "Critical", value: summary.critical, icon: <AlertTriangle className="h-4 w-4" /> },
    { title: "High", value: summary.high, icon: <Activity className="h-4 w-4" /> },
    { title: "Medium", value: summary.medium, icon: <Clock className="h-4 w-4" /> },
    { title: "Healthy", value: summary.healthy, icon: <CheckCircle className="h-4 w-4" /> },
    { title: "Overstock", value: summary.overstock, icon: <Boxes className="h-4 w-4" /> },
  ];

  return (
    <div>
      <PageHeader
        title="AI Inventory Overview"
        description={`Inventory intelligence for ${user?.username ?? "user"} · based on 30 days of sales`}
        action={{ label: "Generate Recommendations", onClick: () => runMutation.mutate() }}
      />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        {tiles.map((t, i) => (
          <StatCard key={t.title} title={t.title} value={t.value} icon={t.icon} loading={isLoading && i === 0} delay={i * 0.03} />
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Reorder Candidates</h2>
            <span className="text-xs text-text-secondary">Live analysis from the deterministic engine</span>
          </div>
          <Button size="sm" variant="outline" disabled={isLoading} onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["ai-summary"] });
            queryClient.invalidateQueries({ queryKey: ["ai-reorder-candidates"] });
          }}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={candidates}
          loading={candidatesLoading}
          keyExtractor={(r: AIReorderCandidate) => r.productId}
          emptyMessage="No products currently need reordering"
        />
      </div>
    </div>
  );
}
