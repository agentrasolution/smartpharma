import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import RiskBadge from "@/components/shared/RiskBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AIRecommendation } from "@/types";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "success" | "warning" | "outline" }> = {
    NEW: { label: "New", variant: "default" },
    ACTIVE: { label: "Active", variant: "warning" },
    ACKNOWLEDGED: { label: "Acknowledged", variant: "success" },
    DISMISSED: { label: "Dismissed", variant: "outline" },
    EXPIRED: { label: "Expired", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function AIRecommendations() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("OPEN");

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["ai-recommendations", filter],
    queryFn: () => {
      if (filter === "OPEN") return api.ai.recommendations.list(undefined, 200);
      return api.ai.recommendations.list(filter, 200);
    },
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.ai.recommendations.acknowledge(id),
    onSuccess: () => {
      toast.success("Recommendation acknowledged");
      queryClient.invalidateQueries({ queryKey: ["ai-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["ai-rec-summary"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.ai.recommendations.dismiss(id),
    onSuccess: () => {
      toast.success("Recommendation dismissed");
      queryClient.invalidateQueries({ queryKey: ["ai-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["ai-rec-summary"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = filter === "OPEN"
    ? list
    : list.filter((r) => r.status === filter);

  const openCount = list.filter((r) => r.status === "NEW" || r.status === "ACTIVE").length;

  const columns = [
    { key: "product", header: "Product", cell: (r: AIRecommendation) => (
      <div>
        <span className="font-medium text-text-primary">{r.product.name}</span>
        <span className="block text-[10px] font-mono text-text-secondary">{r.product.barcode}</span>
      </div>
    ) },
    { key: "risk", header: "Risk", cell: (r: AIRecommendation) => <RiskBadge risk={r.riskLevel} />, className: "text-center" },
    { key: "stock", header: "Stock", cell: (r: AIRecommendation) => (
      <span className="font-mono">{r.currentStock}</span>
    ) },
    { key: "avg", header: "Daily", cell: (r: AIRecommendation) => (
      <span className="font-mono">{r.averageDailySales.toFixed(1)}</span>
    ) },
    { key: "coverage", header: "Coverage", cell: (r: AIRecommendation) => (
      <span className="font-mono text-text-secondary">{r.stockCoverageDays != null ? `${r.stockCoverageDays}d` : "—"}</span>
    ) },
    { key: "qty", header: "Recommended", cell: (r: AIRecommendation) => (
      <span className="font-mono font-semibold text-accent">{r.recommendedQuantity}</span>
    ) },
    { key: "status", header: "Status", cell: (r: AIRecommendation) => <StatusPill status={r.status} />, className: "text-center" },
    { key: "date", header: "Generated", cell: (r: AIRecommendation) => (
      <span className="font-mono text-xs text-text-secondary">{formatDateTime(r.createdAt)}</span>
    ) },
    { key: "actions", header: "Actions", cell: (r: AIRecommendation) => (
      <div className="flex items-center gap-1.5 justify-center">
        {(r.status === "NEW" || r.status === "ACTIVE") && (
          <>
            <Button size="sm" variant="outline" className="h-7" disabled={ackMutation.isPending} onClick={() => ackMutation.mutate(r.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Ack
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-text-secondary" disabled={dismissMutation.isPending} onClick={() => dismissMutation.mutate(r.id)}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    ), className: "text-center" },
  ];

  return (
    <div>
      <PageHeader
        title="AI Recommendations"
        description="Persisted reorder recommendations for human review"
        action={{ label: "Run Analysis", onClick: () => {
          api.ai.recommendations.run(30)
            .then((res) => {
              toast.success(`Generated ${res.created} new recommendations`);
              queryClient.invalidateQueries({ queryKey: ["ai-recommendations"] });
              queryClient.invalidateQueries({ queryKey: ["ai-rec-summary"] });
            })
            .catch((e: Error) => toast.error(e.message));
        } }}
      />

      <Tabs defaultValue="OPEN" onValueChange={setFilter}>
        <TabsList className="mb-4">
          <TabsTrigger value="OPEN">Open ({openCount})</TabsTrigger>
          <TabsTrigger value="NEW">New</TabsTrigger>
          <TabsTrigger value="ACTIVE">Active</TabsTrigger>
          <TabsTrigger value="ACKNOWLEDGED">Acknowledged</TabsTrigger>
          <TabsTrigger value="DISMISSED">Dismissed</TabsTrigger>
          <TabsTrigger value="EXPIRED">Expired</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl border border-border overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          keyExtractor={(r: AIRecommendation) => r.id}
          emptyMessage="No recommendations in this state"
        />
      </div>
    </div>
  );
}
