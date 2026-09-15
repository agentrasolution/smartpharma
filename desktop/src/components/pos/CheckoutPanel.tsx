import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShoppingCart, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CartItem from "@/components/pos/CartItem";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/lib/api";
import type { SaleItemInput, DiscountType, Customer } from "@/types";

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
  onCheckout: (amountPaid: number, discount: number) => Promise<void>;
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickAddress, setQuickAddress] = useState("");
  const [quickFatherName, setQuickFatherName] = useState("");
  const [quickFatherPhone, setQuickFatherPhone] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers.list,
  });

  const queryClient = useQueryClient();
  const quickAddMutation = useMutation({
    mutationFn: () => api.customers.create({ name: quickName, phone: quickPhone, address: quickAddress, fatherName: quickFatherName, fatherPhone: quickFatherPhone }),
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

  const numPaid = Number(amountPaid) || 0;
  const change = Math.max(0, numPaid - total);
  const isPartial = numPaid > 0 && numPaid < total;
  const canPay = items.length > 0 && (numPaid >= total || (isPartial && !!customerId && addToArrears));

  async function handleCheckout() {
    if (!canPay) return;
    setProcessing(true);
    try {
      await onCheckout(numPaid, discount);
      toast.success("Sale completed");
      onClearCart();
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
            <span className="text-[10px] font-normal text-text-secondary bg-surface-2 rounded-full px-1.5 py-px">{items.length}</span>
          )}
        </h2>
        {items.length > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-text-secondary hover:text-danger" onClick={onClearCart}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-text-secondary py-16">
            <ShoppingCart className="h-10 w-10 text-border mb-3" />
            <p className="font-medium">Cart is empty</p>
            <p className="text-[11px] mt-0.5">Scan or search products to add</p>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <CartItem key={item.productId} item={item} onUpdateQuantity={onUpdateQuantity} onIncrementBy={onIncrementBy} onRemove={onRemoveItem} />
            ))}
          </div>
        )}
      </ScrollArea>

      {items.length > 0 && (
        <div className="pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchableSelect
                options={customers.map((c: Customer) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ""}` }))}
                value={customerId || ""}
                onChange={(v) => {
                  const selected = customers.find((c: Customer) => c.id === v);
                  onCustomerChange(v || undefined, selected?.name);
                }}
                placeholder="Customer (optional)"
              />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setQuickAddOpen(true)} title="Quick add customer">
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Separator />

          <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Quick Add Customer</DialogTitle></DialogHeader>
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
                <Button className="w-full" disabled={!quickName || quickAddMutation.isPending} onClick={() => quickAddMutation.mutate()}>
                  {quickAddMutation.isPending ? "Adding..." : "Add Customer & Select"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <div>
            <Label className="text-[10px] text-text-secondary mb-1 block">Notes</Label>
            <textarea
              id="pos-notes"
              value={notes || ""}
              onChange={(e) => onNotesChange?.(e.target.value)}
              rows={2}
              placeholder="Sale notes (optional)"
              className="w-full h-auto rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleDiscountType}
                className="h-7 px-2 rounded-md text-[10px] font-medium border border-border bg-surface-2 hover:bg-border transition-colors shrink-0"
              >
                {discountType === "pkr" ? "PKR" : "%"}
              </button>
              <Input
                id="pos-discount"
                type="number"
                placeholder={`Discount (${discountType === "pkr" ? "PKR" : "%"})`}
                value={discountValue || ""}
                onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
                className="h-7 text-xs font-mono"
              />
            </div>
            {discountValue > 0 && (
              <p className="text-[10px] text-text-secondary text-right mt-0.5">
                {discountType === "percent" ? `= ${formatCurrency(discount)}` : `= ${Math.round(discountValue * 100 / subtotal)}%`}
              </p>
            )}
          </div>

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
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              id="pos-amount-paid"
              type="number"
              placeholder="Amount paid"
              value={amountPaid}
              onChange={(e) => onAmountPaidChange?.(e.target.value)}
              className="h-10 text-base font-mono font-bold text-center"
            />
            {change > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-xs text-success font-semibold"
              >
                Change: {formatCurrency(change)}
              </motion.div>
            )}
            {isPartial && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-to-arrears"
                  checked={addToArrears}
                  onCheckedChange={(val) => onAddToArrearsChange?.(val === true)}
                />
                <Label htmlFor="add-to-arrears" className="text-[11px] cursor-pointer text-text-secondary">
                  Add remaining to arrears
                </Label>
              </div>
            )}
            <Button
              className="w-full h-10 text-sm gap-2"
              disabled={!canPay || processing}
              onClick={handleCheckout}
            >
              {processing ? "Processing..." : `Pay ${formatCurrency(total)}`}
            </Button>
            {isPartial && !customerId && (
              <p className="text-[10px] text-center text-danger">Select a customer for partial payment</p>
            )}
            {isPartial && !!customerId && !addToArrears && (
              <p className="text-[10px] text-center text-text-secondary">Check the box above to add remaining to arrears</p>
            )}
            {error && (
              <p className="text-[10px] text-center text-danger">{error}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
