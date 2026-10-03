"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShoppingCart, Trash2, UserPlus, CreditCard, Banknote,
  ArrowRightLeft, FileText, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CartItem from "@/components/pos/CartItem";
import { formatCurrency, getTenantCurrency } from "@/lib/utils";
import { api } from "@/lib/api";
import type { SaleItemInput, DiscountType, Customer } from "@/types";

export interface TenderPayload {
  paymentMethod: "CASH" | "CARD" | "SPLIT" | "CREDIT";
  cashAmount: number;
  cardAmount: number;
  creditAmount: number;
  prescriptionNumber?: string;
}

interface CheckoutPanelProps {
  items: SaleItemInput[];
  discount: number;
  discountValue: number;
  discountType: DiscountType;
  subtotal: number;
  total: number;
  customerId?: string;
  notes?: string;
  amountPaid?: string;
  addToArrears?: boolean;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onIncrementBy: (productId: string, amount: number) => void;
  onRemoveItem: (productId: string) => void;
  onDiscountChange: (discount: number) => void;
  onToggleDiscountType: () => void;
  onClearCart: () => void;
  onCheckout: (amountPaid: number, discount: number, tenderData?: TenderPayload) => Promise<void>;
  onCustomerChange: (customerId?: string, customerName?: string) => void;
  onNotesChange?: (notes: string) => void;
  onAmountPaidChange?: (amountPaid: string) => void;
  onAddToArrearsChange?: (addToArrears: boolean) => void;
  error?: string;
}

export default function CheckoutPanel({
  items, discount, discountValue, discountType, subtotal, total, customerId, notes,
  amountPaid = "", addToArrears = false,
  onUpdateQuantity, onIncrementBy, onRemoveItem, onDiscountChange, onToggleDiscountType,
  onClearCart, onCheckout, onCustomerChange, onNotesChange, onAmountPaidChange,
  onAddToArrearsChange, error,
}: CheckoutPanelProps) {
  const currency = getTenantCurrency();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickAddress, setQuickAddress] = useState("");
  const [quickFatherName, setQuickFatherName] = useState("");
  const [quickFatherPhone, setQuickFatherPhone] = useState("");

  // Tender Method
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "SPLIT" | "CREDIT">("CASH");
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitCard, setSplitCard] = useState<string>("");
  const [prescriptionNumber, setPrescriptionNumber] = useState<string>("");
  const [showRxInput, setShowRxInput] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers.list,
  });

  const queryClient = useQueryClient();
  const quickAddMutation = useMutation({
    mutationFn: () => api.customers.create({
      name: quickName,
      phone: quickPhone,
      address: quickAddress,
      fatherName: quickFatherName,
      fatherPhone: quickFatherPhone,
    }),
    onSuccess: (customer) => {
      toast.success("Customer added");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCustomerChange(customer.id, customer.name);
      setQuickAddOpen(false);
      setQuickName("");
      setQuickPhone("");
      setQuickAddress("");
      setQuickFatherName("");
      setQuickFatherPhone("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const [processing, setProcessing] = useState(false);

  // Compute effective amounts based on tender
  let effectivePaid = Number(amountPaid) || 0;
  let effectiveCash = 0;
  let effectiveCard = 0;
  let effectiveCredit = 0;

  if (paymentMethod === "CARD") {
    effectivePaid = total;
    effectiveCard = total;
  } else if (paymentMethod === "SPLIT") {
    effectiveCash = Number(splitCash) || 0;
    effectiveCard = Number(splitCard) || 0;
    effectivePaid = effectiveCash + effectiveCard;
  } else if (paymentMethod === "CREDIT") {
    effectiveCredit = Math.max(0, total - (Number(amountPaid) || 0));
    effectiveCash = Number(amountPaid) || 0;
  } else {
    // CASH
    effectiveCash = effectivePaid;
  }

  const change = paymentMethod === "CASH" ? Math.max(0, effectivePaid - total) : 0;
  const isPartial = effectivePaid > 0 && effectivePaid < total;
  const canPay =
    items.length > 0 &&
    (effectivePaid >= total ||
      (paymentMethod === "CREDIT" && !!customerId) ||
      (isPartial && !!customerId && addToArrears));

  async function handleCheckout() {
    if (!canPay) return;
    setProcessing(true);
    try {
      await onCheckout(effectivePaid, discount, {
        paymentMethod,
        cashAmount: effectiveCash,
        cardAmount: effectiveCard,
        creditAmount: effectiveCredit,
        prescriptionNumber: prescriptionNumber.trim() || undefined,
      });
      toast.success("Sale completed successfully");
      onClearCart();
      setPrescriptionNumber("");
    } catch {
      toast.error("Checkout failed");
      console.error("Checkout failed");
    } finally {
      setProcessing(false);
    }
  }

  useEffect(() => {
    const onCheckoutRequest = () => {
      if (canPay) {
        handleCheckout();
      } else {
        document.getElementById("pos-amount-paid")?.focus();
      }
    };
    window.addEventListener("faraz:pos-checkout", onCheckoutRequest);
    return () => window.removeEventListener("faraz:pos-checkout", onCheckoutRequest);
  });

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-accent" />
          Cart
          {items.length > 0 && (
            <span className="text-[10px] font-normal text-text-secondary bg-surface-2 rounded-full px-1.5 py-px">
              {items.length}
            </span>
          )}
        </h2>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-secondary hover:text-danger"
            onClick={onClearCart}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-text-secondary py-10 px-2 text-center">
            <div className="h-12 w-12 rounded-2xl bg-surface-2 border border-border/80 flex items-center justify-center mb-3 text-text-secondary/60 shadow-xs">
              <ShoppingCart className="h-6 w-6 stroke-[1.5]" />
            </div>
            <p className="font-semibold text-text-primary text-sm">Cart is empty</p>
            <p className="text-[11px] text-text-secondary mt-1 max-w-[200px] leading-relaxed">
              Scan barcode or select medicines from catalog to ring up a sale.
            </p>

            {/* Keyboard shortcut pills */}
            <div className="mt-5 w-full max-w-[240px] space-y-1.5 pt-3 border-t border-border/60">
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-2/60 border border-border/60">
                <span className="text-text-secondary font-medium">Search Drug</span>
                <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-surface border border-border/80 text-text-primary shadow-2xs">
                  F2
                </kbd>
              </div>
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-2/60 border border-border/60">
                <span className="text-text-secondary font-medium">Quick Cash</span>
                <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-surface border border-border/80 text-text-primary shadow-2xs">
                  F9
                </kbd>
              </div>
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-2/60 border border-border/60">
                <span className="text-text-secondary font-medium">Clear Cart</span>
                <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-surface border border-border/80 text-text-primary shadow-2xs">
                  ESC
                </kbd>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <CartItem
                key={(item as any).id || `${item.productId}-${item.packagingUnit || 'UNIT'}`}
                item={item as any}
                onUpdateQuantity={onUpdateQuantity}
                onIncrementBy={onIncrementBy}
                onRemove={onRemoveItem}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {items.length > 0 && (
        <div className="pt-3 space-y-3">
          {/* Customer Selection */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchableSelect
                options={customers.map((c: Customer) => ({
                  value: c.id,
                  label: `${c.name}${c.phone ? ` (${c.phone})` : ""}`,
                }))}
                value={customerId || ""}
                onChange={(v) => {
                  const selected = customers.find((c: Customer) => c.id === v);
                  onCustomerChange(v || undefined, selected?.name);
                }}
                placeholder="Customer (optional)"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setQuickAddOpen(true)}
              title="Quick add customer"
            >
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Quick Add Customer Dialog */}
          <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick Add Customer</DialogTitle>
              </DialogHeader>
              <div className="px-5 pb-5 space-y-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={quickName} onChange={(e) => setQuickName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Father Name</Label>
                  <Input value={quickFatherName} onChange={(e) => setQuickFatherName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Father Phone No</Label>
                  <Input value={quickFatherPhone} onChange={(e) => setQuickFatherPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input value={quickAddress} onChange={(e) => setQuickAddress(e.target.value)} />
                </div>
                <Button
                  className="w-full"
                  disabled={!quickName || quickAddMutation.isPending}
                  onClick={() => quickAddMutation.mutate()}
                >
                  {quickAddMutation.isPending ? "Adding..." : "Add Customer & Select"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Prescription Linking Toggle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowRxInput(!showRxInput)}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
              >
                <FileText className="h-3 w-3" />
                {showRxInput ? "Hide Prescription Link" : "+ Link Prescription # (Optional)"}
              </button>
              {prescriptionNumber && (
                <span className="text-[10px] font-mono bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                  Rx: {prescriptionNumber}
                </span>
              )}
            </div>
            {showRxInput && (
              <Input
                placeholder="e.g. RX-2609-123456"
                value={prescriptionNumber}
                onChange={(e) => setPrescriptionNumber(e.target.value)}
                className="h-7 text-xs font-mono"
              />
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <textarea
              id="pos-notes"
              value={notes || ""}
              onChange={(e) => onNotesChange?.(e.target.value)}
              rows={1}
              placeholder="Sale notes (optional)"
              className="w-full h-auto rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          {/* Discount */}
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleDiscountType}
                className="h-7 px-2 rounded-md text-[10px] font-semibold border border-border bg-surface-2 hover:bg-border transition-colors shrink-0"
              >
                {discountType === "pkr" ? currency : "%"}
              </button>
              <Input
                id="pos-discount"
                type="number"
                placeholder={`Discount (${discountType === "pkr" ? currency : "%"})`}
                value={discountValue || ""}
                onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
                className="h-7 text-xs font-mono"
              />
            </div>
            {discountValue > 0 && (
              <p className="text-[10px] text-text-secondary text-right mt-0.5">
                {discountType === "percent"
                  ? `= ${formatCurrency(discount)}`
                  : `= ${Math.round((discountValue * 100) / subtotal)}%`}
              </p>
            )}
          </div>

          {/* Calculation Summary */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span className="font-mono tabular-nums">-{formatCurrency(discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-sm font-bold text-text-primary pt-0.5">
              <span>Total Bill</span>
              <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Multi-Payment Tender Selector */}
          <div className="space-y-2 pt-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block">
              Payment Tender
            </Label>
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("CASH");
                  onAmountPaidChange?.(String(total));
                }}
                className={`py-1.5 px-1 rounded text-center text-[10px] font-bold border transition-all flex flex-col items-center gap-0.5 ${
                  paymentMethod === "CASH"
                    ? "border-accent bg-accent/15 text-accent shadow-xs"
                    : "border-border bg-surface-2 text-text-secondary hover:text-text-primary"
                }`}
              >
                <Banknote className="h-3.5 w-3.5" />
                Cash
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("CARD");
                  onAmountPaidChange?.(String(total));
                }}
                className={`py-1.5 px-1 rounded text-center text-[10px] font-bold border transition-all flex flex-col items-center gap-0.5 ${
                  paymentMethod === "CARD"
                    ? "border-blue-500 bg-blue-500/15 text-blue-500 shadow-xs"
                    : "border-border bg-surface-2 text-text-secondary hover:text-text-primary"
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Card
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("SPLIT");
                  const half = Math.floor(total / 2);
                  setSplitCash(String(half));
                  setSplitCard(String(total - half));
                  onAmountPaidChange?.(String(total));
                }}
                className={`py-1.5 px-1 rounded text-center text-[10px] font-bold border transition-all flex flex-col items-center gap-0.5 ${
                  paymentMethod === "SPLIT"
                    ? "border-purple-500 bg-purple-500/15 text-purple-500 shadow-xs"
                    : "border-border bg-surface-2 text-text-secondary hover:text-text-primary"
                }`}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Split
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("CREDIT");
                  onAddToArrearsChange?.(true);
                  onAmountPaidChange?.("0");
                }}
                className={`py-1.5 px-1 rounded text-center text-[10px] font-bold border transition-all flex flex-col items-center gap-0.5 ${
                  paymentMethod === "CREDIT"
                    ? "border-amber-500 bg-amber-500/15 text-amber-500 shadow-xs"
                    : "border-border bg-surface-2 text-text-secondary hover:text-text-primary"
                }`}
              >
                <Wallet className="h-3.5 w-3.5" />
                Credit
              </button>
            </div>

            {/* Cash Tender Inputs & Quick Buttons */}
            {paymentMethod === "CASH" && (
              <div className="space-y-1.5">
                <Input
                  id="pos-amount-paid"
                  type="number"
                  placeholder="Cash Amount received"
                  value={amountPaid}
                  onChange={(e) => onAmountPaidChange?.(e.target.value)}
                  className="h-9 text-base font-mono font-bold text-center"
                />
                <div className="flex items-center gap-1 justify-center">
                  <button
                    type="button"
                    onClick={() => onAmountPaidChange?.(String(total))}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface-2 border border-border hover:bg-border text-text-primary"
                  >
                    Exact ({formatCurrency(total)})
                  </button>
                  {[10, 50, 100, 500].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => {
                        const cur = Number(amountPaid) || 0;
                        onAmountPaidChange?.(String(cur + inc));
                      }}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border hover:bg-border text-text-secondary"
                    >
                      +{inc}
                    </button>
                  ))}
                </div>

                {change > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-xs text-success font-bold"
                  >
                    Change Due: {formatCurrency(change)}
                  </motion.div>
                )}
              </div>
            )}

            {/* Split Tender Inputs */}
            {paymentMethod === "SPLIT" && (
              <div className="space-y-1.5 p-2 rounded-lg border border-purple-500/30 bg-purple-500/5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-text-secondary">Cash Portion</Label>
                    <Input
                      type="number"
                      placeholder="Cash"
                      value={splitCash}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitCash(val);
                        const cPaid = (Number(val) || 0) + (Number(splitCard) || 0);
                        onAmountPaidChange?.(String(cPaid));
                      }}
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-text-secondary">Card Portion</Label>
                    <Input
                      type="number"
                      placeholder="Card"
                      value={splitCard}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitCard(val);
                        const cPaid = (Number(splitCash) || 0) + (Number(val) || 0);
                        onAmountPaidChange?.(String(cPaid));
                      }}
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-text-secondary flex justify-between">
                  <span>Total Split: {formatCurrency((Number(splitCash) || 0) + (Number(splitCard) || 0))}</span>
                  <span>Difference: {formatCurrency(total - ((Number(splitCash) || 0) + (Number(splitCard) || 0)))}</span>
                </div>
              </div>
            )}

            {/* Credit Tender Input */}
            {paymentMethod === "CREDIT" && (
              <div className="space-y-1.5 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <Label className="text-[10px] text-amber-500 font-semibold">Initial Payment (Optional)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={(e) => onAmountPaidChange?.(e.target.value)}
                  className="h-8 text-xs font-mono font-bold"
                />
                <p className="text-[10px] text-text-secondary">
                  Remaining balance of <strong>{formatCurrency(Math.max(0, total - (Number(amountPaid) || 0)))}</strong> will be added to customer arrears.
                </p>
              </div>
            )}

            {isPartial && paymentMethod !== "CREDIT" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-to-arrears"
                  checked={addToArrears}
                  onCheckedChange={(val) => onAddToArrearsChange?.(val === true)}
                />
                <Label htmlFor="add-to-arrears" className="text-[11px] cursor-pointer text-text-secondary">
                  Add remaining {formatCurrency(total - effectivePaid)} to customer arrears
                </Label>
              </div>
            )}

            <Button
              className="w-full h-10 text-sm gap-2 font-bold"
              disabled={!canPay || processing}
              onClick={handleCheckout}
            >
              {processing
                ? "Processing..."
                : `Complete Sale (${formatCurrency(total)})`}
            </Button>

            {(paymentMethod === "CREDIT" || isPartial) && !customerId && (
              <p className="text-[10px] text-center text-danger font-medium">
                Customer account is required for credit / arrears sales.
              </p>
            )}
            {error && <p className="text-[10px] text-center text-danger font-medium">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
