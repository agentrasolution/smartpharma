import { useState, useEffect, useCallback } from "react";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import StatusBadge from "@/components/shared/StatusBadge";
import PrintPreviewDialog from "@/components/shared/PrintPreviewDialog";
import type { Sale, PrinterConfig } from "@/types";

interface InvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}

export default function InvoiceDetailDialog({ open, onOpenChange, saleId }: InvoiceDetailDialogProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open || !saleId) return;
    setSale(null);
    setLoading(true);
    api.sales.getById(saleId).then((data) => {
      setSale(data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [open, saleId]);

  const generateReceiptHtml = useCallback(async (paperSize: string): Promise<string> => {
    if (!sale) return "";
    const printData = {
      ...sale,
      customer_total_arrears: 0,
      payment_method: sale.payment_method || "CASH",
      cash_amount: sale.cash_amount,
      card_amount: sale.card_amount,
      credit_amount: sale.credit_amount,
      prescription_number: sale.prescription_number,
      cashier_name: sale.cashier_name,
      items: sale.items?.map((i) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
        batch_number: i.batch_number,
        expiry_date: i.expiry_date,
      })) || [],
    };
    const result = await window.generateReceiptHTML(printData, paperSize);
    return result.success ? result.html : "";
  }, [sale]);

  async function handlePrint(config: PrinterConfig) {
    if (!sale) return;
    const printData = {
      ...sale,
      customer_total_arrears: 0,
      payment_method: sale.payment_method || "CASH",
      cash_amount: sale.cash_amount,
      card_amount: sale.card_amount,
      credit_amount: sale.credit_amount,
      prescription_number: sale.prescription_number,
      cashier_name: sale.cashier_name,
      items: sale.items?.map((i) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
        batch_number: i.batch_number,
        expiry_date: i.expiry_date,
      })) || [],
    };
    const result = await window.printReceipt(printData, config);
    if (!result.success) {
      throw new Error(result.error || "Print failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
        {loading ? (
          <div className="px-5 pb-6 pt-8 space-y-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : !sale ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-text-secondary">
            <span className="text-xs">Invoice not found</span>
          </div>
        ) : (
          <div className="px-5 pb-5 pt-2">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-xs font-display font-semibold text-text-primary tracking-tight">
                Invoice
              </h2>
              <span className="text-[10px] font-mono text-text-secondary tabular-nums">
                {formatDateTime(sale.created_at)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="font-mono text-[10px] text-text-secondary tracking-wider">
                {sale.id}
              </p>
              {sale.prescription_number && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                  Rx: {sale.prescription_number}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-primary mb-3 pb-2.5 border-b border-border">
              <div>
                <span className="text-text-secondary text-[10px] block">Customer</span>
                {sale.customer_name ? (
                  <span className="font-medium">{sale.customer_name}</span>
                ) : (
                  <span className="text-text-secondary italic">Walk-in Customer</span>
                )}
              </div>
              {sale.cashier_name && (
                <div className="text-right">
                  <span className="text-text-secondary text-[10px] block">Cashier</span>
                  <span className="text-text-primary font-medium">{sale.cashier_name}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4">
              {(sale.items || []).map((item) => {
                const qty = String(item.quantity);
                const price = formatCurrency(item.unit_price);
                const total = formatCurrency(item.subtotal);
                const name = item.product_name || "";
                return (
                  <div key={item.id} className="border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex items-baseline gap-2 text-[11px] leading-relaxed">
                      <span className="text-text-primary truncate flex-1 min-w-0 font-medium">{name}</span>
                      <span className="font-mono text-text-secondary shrink-0 tabular-nums">
                        {qty} &times; {price}
                      </span>
                      <span className="font-mono font-medium text-text-primary w-[72px] text-right shrink-0 tabular-nums">
                        {total}
                      </span>
                    </div>
                    {(item.batch_number || item.expiry_date) && (
                      <div className="flex items-center gap-2 text-[10px] font-mono text-text-secondary mt-0.5 pl-1">
                        {item.batch_number && <span>Batch: {item.batch_number}</span>}
                        {item.batch_number && item.expiry_date && <span>&bull;</span>}
                        {item.expiry_date && (
                          <span>Exp: {new Date(item.expiry_date).toLocaleDateString(undefined, { year: "numeric", month: "short" })}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border pt-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <span className="font-mono text-text-primary tabular-nums">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Discount</span>
                  <span className="font-mono text-danger tabular-nums">&minus;{formatCurrency(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-border -mx-1 px-1">
                <span className="text-text-primary">Total</span>
                <span className="font-mono tabular-nums">{formatCurrency(sale.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Payment Tender</span>
                <span className="font-mono font-medium px-2 py-0.5 rounded text-[11px] bg-surface-2 border border-border">
                  {sale.payment_method || "CASH"}
                </span>
              </div>
              {sale.payment_method === "SPLIT" ? (
                <div className="pl-3 py-1 space-y-1 border-l-2 border-accent/40 my-1 bg-surface/50 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Cash Portion</span>
                    <span className="font-mono text-success tabular-nums">{formatCurrency(sale.cash_amount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Card Portion</span>
                    <span className="font-mono text-accent tabular-nums">{formatCurrency(sale.card_amount ?? 0)}</span>
                  </div>
                </div>
              ) : sale.payment_method === "CREDIT" ? (
                <div className="flex justify-between text-[11px]">
                  <span className="text-warning">Added to Customer Arrears</span>
                  <span className="font-mono text-warning tabular-nums">{formatCurrency(sale.credit_amount ?? sale.total)}</span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Paid</span>
                  <span className="font-mono text-success tabular-nums">{formatCurrency(sale.amount_paid)}</span>
                </div>
              )}
              {sale.change > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Change</span>
                  <span className="font-mono text-text-primary tabular-nums">{formatCurrency(sale.change)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-text-secondary">Status</span>
                <StatusBadge status={sale.status} />
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setShowPreview(true)}
              className="w-full mt-5 h-8 gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Receipt
            </Button>
          </div>
        )}
      </DialogContent>

      {showPreview && sale && (
        <PrintPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          title="Invoice Preview"
          htmlGenerator={generateReceiptHtml}
          onPrint={handlePrint}
        />
      )}
    </Dialog>
  );
}
