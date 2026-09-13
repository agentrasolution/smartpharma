import { Badge } from "@/components/ui/badge";

const statusMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "outline" }> = {
  paid: { label: "Paid", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  settled: { label: "Settled", variant: "success" },
  partial: { label: "Partial", variant: "warning" },
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "outline" },
  low: { label: "Low Stock", variant: "danger" },
  expiring: { label: "Expiring Soon", variant: "warning" },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
