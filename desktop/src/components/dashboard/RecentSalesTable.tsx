import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import DataTable from "@/components/shared/DataTable";
import { api } from "@/lib/api";
import type { Sale } from "@/types";

export default function RecentSalesTable() {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["recent-sales"],
    queryFn: () => api.sales.listRecent(5),
  });

  const columns = [
    { key: "created_at", header: "Date", cell: (s: Sale) => <span className="font-mono text-xs text-text-secondary">{formatDateTime(s.created_at)}</span> },
    { key: "customer_name", header: "Customer", cell: (s: Sale) => <span className="text-text-primary">{s.customer_name || "Walk-in"}</span> },
    { key: "total", header: "Total", cell: (s: Sale) => <span className="font-mono font-medium">{formatCurrency(s.total)}</span> },
    { key: "amount_paid", header: "Paid", cell: (s: Sale) => <span className="font-mono">{formatCurrency(s.amount_paid)}</span> },
    { key: "status", header: "Status", cell: (s: Sale) => <StatusBadge status={s.status} />, className: "text-center" },
  ];

  return <DataTable columns={columns} data={sales} loading={isLoading} keyExtractor={(s: Sale) => s.id} />;
}
