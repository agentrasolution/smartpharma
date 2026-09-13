import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Minus, Trash2, AlertCircle, Download, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import PrintPreviewDialog from "@/components/shared/PrintPreviewDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import type { ReturnEntry, Sale, SaleItem, PrinterConfig } from "@/types";

export default function Returns() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [pendingReturnData, setPendingReturnData] = useState<ReturnEntry | null>(null);
  const [pendingSale, setPendingSale] = useState<Sale | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ReturnEntry | null>(null);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState<Sale[]>([]);
  const [searchingInvoice, setSearchingInvoice] = useState(false);

  const { data: returns = [], isLoading } = useQuery({ queryKey: ["returns"], queryFn: api.returns.list });

  const { data: selectedSale, isLoading: loadingSale } = useQuery({
    queryKey: ["sale", selectedSaleId],
    queryFn: () => api.sales.getById(selectedSaleId),
    enabled: !!selectedSaleId,
  });

  useEffect(() => {
    const q = invoiceSearch.trim();
    if (!q) {
      setInvoiceResults([]);
      return;
    }
    setSearchingInvoice(true);
    const t = setTimeout(async () => {
      try {
        const results = await api.sales.search(q);
        setInvoiceResults(results);
      } catch {
        setInvoiceResults([]);
      } finally {
        setSearchingInvoice(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [invoiceSearch]);

  const filtered = returns.filter((r: ReturnEntry) =>
    !search || r.sale_id.includes(search) || r.reason.toLowerCase().includes(search.toLowerCase())
  );

  const hasReturns = (selectedSale?.return_count ?? 0) > 0;
  const fullyReturned = (selectedSale?.items?.length ?? 0) > 0 &&
    (selectedSale?.items ?? []).every((i: SaleItem) => (i.quantity - (i.returned_qty ?? 0)) <= 0);

  function selectSale(sale: Sale) {
    setSelectedSaleId(sale.id);
    setReturnQtys({});
    setError("");
  }

  function handleInvoiceSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    if (invoiceResults.length === 1) {
      selectSale(invoiceResults[0]);
      setInvoiceResults([]);
      setInvoiceSearch("");
      return;
    }
    const exact = invoiceResults.find((s) => s.id.toLowerCase() === invoiceSearch.trim().toLowerCase());
    if (exact) {
      selectSale(exact);
      setInvoiceResults([]);
      setInvoiceSearch("");
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSale?.items) throw new Error("Sale items not loaded");
      const saleItems = selectedSale.items;
      const items = Object.entries(returnQtys)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, quantity]) => {
          const item = saleItems.find((i: SaleItem) => i.product_id === productId);
          return { productId, productName: item?.product_name || "", quantity, refundAmount: (item?.unit_price || 0) * quantity };
        });
      return api.returns.create({
        saleId: selectedSaleId,
        refundAmount: items.reduce((s, i) => s + i.refundAmount, 0),
        reason,
        items,
      });
    },
    onSuccess: (returnData) => {
      toast.success("Return processed");
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });

      setPendingReturnData(returnData);
      if (selectedSale) setPendingSale(selectedSale);
      setShowPrintPreview(true);

      setOpen(false);
      setSelectedSaleId("");
      setReason("");
      setReturnQtys({});
      setError("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setError(err instanceof Error ? err.message : "Failed to process return");
    },
  });

  const generateReturnHtml = useCallback(async (paperSize: string): Promise<string> => {
    if (!pendingReturnData || !pendingSale) return "";
    const printPayload = {
      ...pendingReturnData,
      items: pendingReturnData.items || [],
      reason: pendingReturnData.reason,
    };
    const result = await window.generateReturnReceiptHTML(printPayload, pendingSale, paperSize);
    return result.success ? result.html : "";
  }, [pendingReturnData, pendingSale]);

  async function handlePrintReturn(config: PrinterConfig) {
    if (!pendingReturnData || !pendingSale) return;
    const printPayload = {
      ...pendingReturnData,
      items: pendingReturnData.items || [],
      reason: pendingReturnData.reason,
    };
    const result = await window.printReturnReceipt(printPayload, pendingSale, config);
    if (!result.success) {
      throw new Error(result.error || "Print failed");
    }
  }

  const columns = [
    { key: "created_at", header: "Date", cell: (r: ReturnEntry) => <span className="font-mono text-xs text-text-secondary">{formatDateTime(r.created_at)}</span> },
    { key: "sale_id", header: "Sale ID", cell: (r: ReturnEntry) => <span className="font-mono text-xs text-text-secondary">{r.sale_id}</span> },
    { key: "customer_name", header: "Customer", cell: (r: ReturnEntry) => <span className="text-text-secondary">{r.customer_name || "—"}</span> },
    { key: "refund_amount", header: "Refund Amount", cell: (r: ReturnEntry) => <span className="font-mono font-medium text-danger">{formatCurrency(r.refund_amount)}</span> },
    { key: "reason", header: "Reason", cell: (r: ReturnEntry) => <span className="text-text-secondary">{r.reason}</span> },
  ];

  return (
    <div>
      <PageHeader title="Returns" description="Process and track product returns" action={{ label: "New Return", onClick: () => setOpen(true) }} />
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input autoFocus placeholder="Search returns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCSV(`returns_${new Date().toISOString().split("T")[0]}.csv`, ["Date","Sale ID","Customer","Refund Amount","Reason"], filtered.map((r: ReturnEntry) => [r.created_at, r.sale_id, r.customer_name || "", r.refund_amount, r.reason]))}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadPDF(`returns_${new Date().toISOString().split("T")[0]}.pdf`, "Returns List", ["Date","Sale ID","Customer","Refund Amount","Reason"], filtered.map((r: ReturnEntry) => [r.created_at, r.sale_id, r.customer_name || "", r.refund_amount, r.reason]))}>
          <Download className="h-4 w-4 mr-1" /> PDF
        </Button>
      </div>
      <div className="rounded-xl border border-border">
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          keyExtractor={(r: ReturnEntry) => r.id}
          onRowClick={(r: ReturnEntry) => setSelectedReturn(r)}
        />
      </div>

      <Dialog open={open} onOpenChange={(v) => {
        if (!v) {
          setSelectedSaleId("");
          setReason("");
          setReturnQtys({});
          setInvoiceSearch("");
          setInvoiceResults([]);
          setError("");
        }
        setOpen(v);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Return</DialogTitle></DialogHeader>
          <div className="px-5 pb-5 space-y-4">
            <div>
              <Label>Search Invoice</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <Input
                  placeholder="Search invoice ID, customer or product..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={handleInvoiceSearchKeyDown}
                  className="pl-9"
                />
              </div>
              {searchingInvoice && (
                <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching invoices...
                </p>
              )}
              {!searchingInvoice && invoiceSearch.trim() && invoiceResults.length > 0 && (
                <div className="mt-1 border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                  {invoiceResults.map((s: Sale) => {
                    const isReturned = (s.return_count ?? 0) > 0;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { selectSale(s); setInvoiceSearch(""); setInvoiceResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-surface-2 flex items-center justify-between gap-2 disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs">{s.id}</span>
                          <span className="text-xs text-text-secondary truncate">{s.customer_name || "Walk-in"}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs">{formatCurrency(s.total)}</span>
                          {isReturned && <span className="text-xs text-danger">[Returned]</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!searchingInvoice && invoiceSearch.trim() && invoiceResults.length === 0 && (
                <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> No invoices found for "{invoiceSearch}"
                </p>
              )}
            </div>

            {selectedSaleId && (
              loadingSale ? (
                <div className="flex items-center justify-center py-8">
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : selectedSale ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary shrink-0">Invoice:</span>
                      <span className="font-mono font-medium truncate">{selectedSale.id}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-text-secondary mt-1">
                      <span className="truncate">{selectedSale.customer_name || "Walk-in"}</span>
                      <span className="shrink-0">{formatDateTime(selectedSale.created_at)}</span>
                      <span className="font-mono shrink-0">{formatCurrency(selectedSale.total)}</span>
                    </div>
                  </div>

                  {hasReturns && (
                    <p className={`text-xs flex items-center gap-1 ${fullyReturned ? "text-danger" : "text-accent"}`}>
                      <AlertCircle className="h-3 w-3" />
                      {fullyReturned
                        ? "This invoice has already been fully returned"
                        : "This invoice has partial returns — you can return the remaining items"}
                    </p>
                  )}

                  {selectedSale.items && selectedSale.items.length > 0 && !fullyReturned && (
                    <div>
                      <Label className="mb-2 block">Items to Return</Label>
                      <div className="max-h-48 overflow-y-auto space-y-2 border border-border rounded-lg p-3">
                        {selectedSale.items.map((item: SaleItem) => {
                          const returnedQty = item.returned_qty ?? 0;
                          const remaining = item.quantity - returnedQty;
                          const qty = returnQtys[item.product_id] || 0;
                          const showDelete = qty > 0;
                          return (
                            <div key={item.product_id} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{item.product_name}</p>
                                <p className="text-xs text-text-secondary font-mono">
                                  {formatCurrency(item.unit_price)} × {item.quantity}
                                  {returnedQty > 0 && (
                                    <span className="text-accent"> ({returnedQty} returned, {remaining} left)</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setReturnQtys(prev => ({ ...prev, [item.product_id]: Math.max(0, (prev[item.product_id] || 0) - 1) }))}
                                  className="h-7 w-7 rounded-md bg-surface-2 flex items-center justify-center hover:bg-border"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-6 text-center text-sm font-mono">{qty}</span>
                                <button
                                  onClick={() => setReturnQtys(prev => ({ ...prev, [item.product_id]: Math.min(remaining, (prev[item.product_id] || 0) + 1) }))}
                                  disabled={remaining <= 0}
                                  className={`h-7 w-7 rounded-md flex items-center justify-center ${remaining <= 0 ? "opacity-40 cursor-not-allowed" : "bg-surface-2 hover:bg-border"}`}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                {showDelete && (
                                  <button
                                    onClick={() => {
                                      const next = { ...returnQtys };
                                      delete next[item.product_id];
                                      setReturnQtys(next);
                                    }}
                                    className="h-7 w-7 rounded-md bg-danger/10 flex items-center justify-center hover:bg-danger/20 ml-1"
                                  >
                                    <Trash2 className="h-3 w-3 text-danger" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedSale.items && selectedSale.items.length === 0 && (
                    <p className="text-sm text-text-secondary text-center py-4">No items found for this sale.</p>
                  )}

                  {!fullyReturned && (
                    <>
                      <div>
                        <Label>Reason (optional)</Label>
                        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged, Expired, Wrong item" />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Total Refund:</span>
                        <span className="font-mono font-bold text-danger">
                          {formatCurrency(Object.entries(returnQtys).reduce((s, [id, qty]) => {
                            const item = selectedSale.items?.find((i: SaleItem) => i.product_id === id);
                            return s + (item?.unit_price || 0) * qty;
                          }, 0))}
                        </span>
                      </div>
                    </>
                  )}

                  <Button
                    className="w-full"
                    disabled={!selectedSaleId || !Object.values(returnQtys).some(q => q > 0)}
                    onClick={() => createMutation.mutate()}
                  >
                    {createMutation.isPending ? "Processing..." : "Process Return"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-danger text-center py-4 flex items-center justify-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Invoice not found
                </p>
              )
            )}

            {error && (
              <p className="text-sm text-danger flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showPrintPreview && pendingReturnData && pendingSale && (
        <PrintPreviewDialog
          open={showPrintPreview}
          onOpenChange={(v) => {
            setShowPrintPreview(v);
            if (!v) {
              setPendingReturnData(null);
              setPendingSale(null);
            }
          }}
          title="Return Receipt Preview"
          htmlGenerator={generateReturnHtml}
          onPrint={handlePrintReturn}
        />
      )}

      <Dialog open={!!selectedReturn} onOpenChange={(v) => { if (!v) setSelectedReturn(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Return Details</DialogTitle></DialogHeader>
          {selectedReturn && (
            <div className="px-5 pb-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-text-secondary">Sale ID:</span> <span className="font-mono">{selectedReturn.sale_id}</span></div>
                <div><span className="text-text-secondary">Customer:</span> <span>{selectedReturn.customer_name || "—"}</span></div>
                <div><span className="text-text-secondary">Date:</span> <span>{formatDateTime(selectedReturn.created_at)}</span></div>
                <div><span className="text-text-secondary">Refund:</span> <span className="font-mono text-danger">{formatCurrency(selectedReturn.refund_amount)}</span></div>
                <div className="col-span-2"><span className="text-text-secondary">Reason:</span> <span>{selectedReturn.reason}</span></div>
              </div>
              {selectedReturn.items && selectedReturn.items.length > 0 && (
                <div>
                  <Label className="mb-1 block">Items Returned</Label>
                  <div className="border border-border rounded-lg divide-y divide-border text-sm">
                    {selectedReturn.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <span>{item.product_name} × {item.quantity}</span>
                        <span className="font-mono">{formatCurrency(item.refund_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
