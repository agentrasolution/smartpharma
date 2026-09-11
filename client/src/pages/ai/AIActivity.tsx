import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AIAuditLog } from "@/types";

export default function AIActivity() {
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-audit-logs"],
    queryFn: () => api.ai.auditLogs(200),
  });

  const columns = [
    { key: "time", header: "Time", cell: (l: AIAuditLog) => (
      <span className="font-mono text-xs text-text-secondary">{formatDateTime(l.createdAt)}</span>
    ) },
    { key: "agent", header: "Agent", cell: (l: AIAuditLog) => (
      <span className="font-mono text-xs text-text-primary">{l.agentName}</span>
    ) },
    { key: "action", header: "Action", cell: (l: AIAuditLog) => (
      <span className="font-mono text-xs text-text-primary">{l.action || "—"}</span>
    ) },
    { key: "tool", header: "Tool", cell: (l: AIAuditLog) => (
      <span className="font-mono text-xs text-text-secondary">{l.toolName || "—"}</span>
    ) },
    { key: "approval", header: "Approval", cell: (l: AIAuditLog) => (
      l.approvalRequired ? (
        <Badge variant={l.approvalStatus === "APPROVED" ? "success" : l.approvalStatus === "REJECTED" ? "danger" : "warning"}>
          {l.approvalStatus || "Required"}
        </Badge>
      ) : <span className="text-xs text-text-secondary">—</span>
    ), className: "text-center" },
    { key: "status", header: "Status", cell: (l: AIAuditLog) => (
      <Badge variant={l.status === "SUCCESS" ? "success" : "danger"}>{l.status}</Badge>
    ), className: "text-center" },
  ];

  return (
    <div>
      <PageHeader
        title="AI Activity Log"
        description="Audit trail of agent actions and tool calls"
        action={{ label: "Refresh", onClick: () => refetch() }}
      />

      <div className="rounded-xl border border-border overflow-hidden">
        <DataTable
          columns={columns}
          data={logs}
          loading={isLoading}
          keyExtractor={(l: AIAuditLog) => l.id}
          emptyMessage="No AI activity recorded yet"
        />
      </div>
    </div>
  );
}
