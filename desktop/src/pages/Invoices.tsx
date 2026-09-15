import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Calendar, Download, FileText } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import InvoiceDetailDialog from "@/components/shared/InvoiceDetailDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import StatusBadge from "@/components/shared/StatusBadge";
import type { Sale } from "@/types";

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["invoices", search, dateFrom, dateTo],
    queryFn: () => api.sales.listAll({ search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });

  const exportData = useCallback(() => {
    const headers = ["Sale ID", "Date", "Customer", "Items", "Subtotal", "Discount", "Total", "Paid", "Change", "Status"];
    return sales.map((s: Sale) => [
      s.id, s.created_at, s.customer_name || "Walk-in",
      s.item_count ?? 0, s.subtotal, s.discount, s.total, s.amount_paid, s.change, s.status,
    ]);
  }, [sales]);

  const handleExportCSV = useCallback(() => {
    const headers = ["Sale ID", "Date", "Customer", "Items", "Subtotal", "Discount", "Total", "Paid", "Change", "Status"];
    downloadCSV(`invoices_${dateFrom || "all"}_${dateTo || "all"}.csv`, headers, exportData());
  }, [exportData, dateFrom, dateTo]);

  const handleExportPDF = useCallback(() => {
    const headers = ["Sale ID", "Date", "Customer", "Items", "Subtotal", "Discount", "Total", "Paid", "Change", "Status"];
    downloadPDF(`invoices_${dateFrom || "all"}_${dateTo || "all"}.pdf`, "Invoices & Billing", headers, exportData());
  }, [exportData, dateFrom, dateTo]);

  const columns = [
    { key: "created_at", header: "Date", cell: (s: Sale) => <span className="font-mono text-xs text-text-secondary">{formatDateTime(s.created_at)}</span> },
    { key: "id", header: "Invoice ID", cell: (s: Sale) => <span className="font-mono text-xs text-text-secondary">{s.id}</span> },
    { key: "customer_name", header: "Customer", cell: (s: Sale) => <span>{s.customer_name || "Walk-in"}</span> },
    { key: "item_count", header: "Items", cell: (s: Sale) => <span className="font-mono text-sm">{(s as any).item_count ?? s.items?.length ?? 0}</span> },
    { key: "total", header: "Total", cell: (s: Sale) => <span className="font-mono font-medium">{formatCurrency(s.total)}</span> },
    { key: "amount_paid", header: "Paid", cell: (s: Sale) => <span className="font-mono">{formatCurrency(s.amount_paid)}</span> },
    { key: "status", header: "Status", cell: (s: Sale) => <StatusBadge status={s.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Invoices & Billing" description="View and export all sales invoices" />
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <Input autoFocus placeholder="Search by invoice ID or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-secondary" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
          <span className="text-text-secondary text-sm">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={sales.length === 0}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={sales.length === 0}>
          <FileText className="h-4 w-4 mr-1" /> PDF
        </Button>
      </div>
      <div className="rounded-xl border border-border">
        <DataTable
          columns={columns}
          data={sales}
          loading={isLoading}
          keyExtractor={(s: Sale) => s.id}
          onRowClick={(s: Sale) => setSelectedSaleId(s.id)}
        />
      </div>

      <InvoiceDetailDialog
        open={!!selectedSaleId}
        onOpenChange={(v) => { if (!v) setSelectedSaleId(null); }}
        saleId={selectedSaleId}
      />
    </div>
  );
}
