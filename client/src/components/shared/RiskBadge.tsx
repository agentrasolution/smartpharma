import { Badge } from "@/components/ui/badge";

const riskMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "outline" }> = {
  CRITICAL: { label: "Critical", variant: "danger" },
  HIGH: { label: "High", variant: "warning" },
  MEDIUM: { label: "Medium", variant: "default" },
  HEALTHY: { label: "Healthy", variant: "success" },
  OVERSTOCK: { label: "Overstock", variant: "outline" },
};

interface RiskBadgeProps {
  risk: string;
}

export default function RiskBadge({ risk }: RiskBadgeProps) {
  const config = riskMap[risk] || { label: risk.replace(/_/g, " "), variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
