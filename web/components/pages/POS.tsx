"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import BarcodeInput from "@/components/pos/BarcodeInput";
import ProductCard from "@/components/pos/ProductCard";
import CheckoutPanel, { TenderPayload } from "@/components/pos/CheckoutPanel";
import PrintPreviewDialog from "@/components/shared/PrintPreviewDialog";
import { useMultiSale } from "@/hooks/useMultiSale";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";
import { setLastReceipt } from "@/lib/receiptStore";
import { toast } from "sonner";
import { Plus, Package } from "lucide-react";
import PosShiftManager from "@/components/pos/PosShiftManager";
import type { Product, PrinterConfig, ProductPrice } from "@/types";

interface PackagingOption {
  key: string;
  label: string;
  unitType: string;
  conversionRatio: number;
  salePrice: number;
  description: string;
}

function getPackagingOptions(product: Product): PackagingOption[] {
  const options: PackagingOption[] = [];
  const baseUnit = product.baseUnit || "Tablet";
  const packageUnit = product.packageUnit || "Box";
  const unitsPerPack = product.unitsPerPack && product.unitsPerPack > 0 ? product.unitsPerPack : (product.pack_size || 1);
  const stripsPerPack = product.stripsPerPack && product.stripsPerPack > 0 ? product.stripsPerPack : 1;

  // 1. Standard / Full Box
  options.push({
    key: "unit-box",
    label: `${packageUnit} (Full Pack)`,
    unitType: packageUnit.toUpperCase(),
    conversionRatio: unitsPerPack,
    salePrice: product.sale_price,
    description: `Contains ${unitsPerPack} ${baseUnit}s`,
  });

  // 2. Strip (if multi-strip pack)
  if (stripsPerPack > 1) {
    const unitsPerStrip = Math.max(1, Math.floor(unitsPerPack / stripsPerPack));
    const customStrip = product.prices?.find(
      (p) => (p.unitType?.toUpperCase() === "STRIP") || p.label.toLowerCase().includes("strip")
    );
    const stripPrice = customStrip?.salePrice && customStrip.salePrice > 0
      ? customStrip.salePrice
      : Math.round((product.sale_price / stripsPerPack) * 100) / 100;

    options.push({
      key: "unit-strip",
      label: `Strip (1/${stripsPerPack} Pack)`,
      unitType: "STRIP",
      conversionRatio: unitsPerStrip,
      salePrice: stripPrice,
      description: `Contains ${unitsPerStrip} ${baseUnit}s`,
    });
  }

  // 3. Single Tablet / Base Unit (if unitsPerPack > 1)
  if (unitsPerPack > 1) {
    const customUnit = product.prices?.find(
      (p) => (p.unitType?.toUpperCase() === "TABLET" || p.unitType?.toUpperCase() === "UNIT") || p.label.toLowerCase().includes("unit") || p.label.toLowerCase().includes("tablet")
    );
    const unitPrice = customUnit?.salePrice && customUnit.salePrice > 0
      ? customUnit.salePrice
      : Math.round((product.sale_price / unitsPerPack) * 100) / 100;

    options.push({
      key: "unit-single",
      label: `Single ${baseUnit}`,
      unitType: baseUnit.toUpperCase(),
      conversionRatio: 1,
      salePrice: unitPrice,
      description: `1 single ${baseUnit}`,
    });
  }

  // 4. Any custom price tiers configured on product that aren't already included
  if (product.prices && product.prices.length > 0) {
    for (const p of product.prices) {
      const isAlreadyIncluded = options.some(
        (o) => o.label.toLowerCase() === p.label.toLowerCase() || (p.unitType && o.unitType === p.unitType.toUpperCase())
      );
      if (!isAlreadyIncluded) {
        options.push({
          key: `price-${p.id}`,
          label: p.label || "Custom Price",
          unitType: p.unitType || "UNIT",
          conversionRatio: p.conversionRatio || 1,
          salePrice: p.salePrice,
          description: p.conversionRatio && p.conversionRatio > 1 ? `${p.conversionRatio} base units` : "Custom tier",
        });
      }
    }
  }

  return options;
}

export default function POS() {
  const searchParams = useSearchParams();
  const isPosWindow = searchParams.get("pos") === "1";
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const debouncedSearch = useDebounce(search, 200);
  const cart = useMultiSale();
  const queryClient = useQueryClient();

  const { data: activeShift, isLoading: isShiftLoading } = useQuery({
    queryKey: ["active-shift"],
    queryFn: () => api.shifts.getActive(),
    refetchInterval: 15000,
  });

  const [pricePickerOpen, setPricePickerOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const pendingPrices = pendingProduct
    ? ((pendingProduct as any).prices as ProductPrice[] | undefined)
    : undefined;

  const [lastSaleData, setLastSaleData] = useState<unknown>(null);
  const [pendingPrintData, setPendingPrintData] = useState<unknown>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.ctrlKey && e.key.toLowerCase() === "p" || (e.altKey && e.key.toLowerCase() === "t")) {
        e.preventDefault();
        if (lastSaleData) {
          setPendingPrintData(lastSaleData);
          setShowPrintDialog(true);
        } else {
          toast.error("No recent sale to reprint");
        }
        return;
      }
      if ((e.ctrlKey && e.key === "Enter") || (e.ctrlKey && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("faraz:pos-checkout"));
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        document.getElementById("pos-discount")?.focus();
        return;
      }
      if (typing || e.ctrlKey || e.altKey || e.metaKey) return;

      const last = cart.items[cart.items.length - 1];
      if (e.key === "Delete") {
        if (last) cart.removeItem(last.productId);
        return;
      }
      if (e.key === "+" || e.key === "=") {
        if (last) cart.incrementBy(last.productId, 1);
        return;
      }
      if (e.key === "-") {
        if (last) cart.updateQuantity(last.productId, last.quantity - 1);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart, lastSaleData]);

  const { data: products = [] } = useQuery({
    queryKey: ["products", debouncedSearch],
    queryFn: () => api.products.search(debouncedSearch),
    enabled: debouncedSearch.length > 0,
  });

  const allProducts = useQuery({
    queryKey: ["products", "browse"],
    queryFn: () => api.products.list({ pageSize: 100 }),
    enabled: debouncedSearch.length === 0,
  });

  const displayProducts = useMemo(() => {
    if (debouncedSearch.length > 0) return products;
    return allProducts.data?.data ?? [];
  }, [debouncedSearch, products, allProducts.data]);

  function addProductToCart(product: Product, salePrice: number, packagingUnit?: string, conversionRatio?: number) {
    if (product.stock_qty === 0) {
      setError(`${product.name} is out of stock`);
      return;
    }
    cart.addItem(
      { ...product, sale_price: salePrice },
      {
        packagingUnit: packagingUnit || product.packageUnit || "UNIT",
        conversionRatio: conversionRatio || 1,
        unitPrice: salePrice,
      }
    );
  }

  function promptPriceTier(product: Product) {
    const options = getPackagingOptions(product);
    if (options.length > 1) {
      setPendingProduct(product);
      setPricePickerOpen(true);
    } else {
      addProductToCart(product, product.sale_price, product.packageUnit || "UNIT", product.unitsPerPack || 1);
    }
  }

  function handleTierSelect(opt: PackagingOption) {
    if (!pendingProduct) return;
    addProductToCart(pendingProduct, opt.salePrice, opt.unitType, opt.conversionRatio);
    setPendingProduct(null);
    setPricePickerOpen(false);
  }

  const handleBarcodeSubmit = async (value: string) => {
    const product = await api.products.getByBarcode(value);
    if (product) {
      promptPriceTier(product);
    } else {
      const found = displayProducts.find(
        (p: Product) => p.barcode === value || p.name.toLowerCase() === value.toLowerCase()
      );
      if (found) {
        promptPriceTier(found);
      }
    }
  };

  const handleAddProduct = (product: Product) => {
    if (product.stock_qty === 0) {
      setError(`${product.name} is out of stock`);
      return;
    }
    promptPriceTier(product);
  };

  const handleNewSale = async () => {
    if (typeof window.openPosWindow === "function") {
      const result = await window.openPosWindow();
      if (!result.success) {
        toast.error(result.error || "Could not open new sale window");
      }
      return;
    }
    window.open("/pos?pos=1", "_blank");
  };

  const handleCheckout = async (amountPaid: number, discount: number, tenderData?: TenderPayload) => {
    setError("");
    if (!activeShift) {
      setError("Register is closed. Please open a shift before checking out.");
      toast.error("Register is closed. Please open a shift before ringing up sales.");
      return;
    }
    try {
      const sale = await api.sales.create({
        customerId: cart.customerId,
        items: cart.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode,
          quantity: item.quantity,
          packagingUnit: item.packagingUnit || "UNIT",
          conversionRatio: item.conversionRatio || 1,
          quantityBaseUnits: (item.quantityBaseUnits ?? (item.quantity * (item.conversionRatio || 1))),
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          batchId: item.batchId,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
        })),
        subtotal: cart.subtotal,
        discount,
        total: cart.total,
        amountPaid,
        paymentMethod: tenderData?.paymentMethod ?? "CASH",
        cashAmount: tenderData?.cashAmount,
        cardAmount: tenderData?.cardAmount,
        creditAmount: tenderData?.creditAmount,
        prescriptionNumber: tenderData?.prescriptionNumber || undefined,
        notes: cart.notes,
      });

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["active-shift"] });

      let customerTotalArrears = 0;
      if (cart.customerId) {
        const customer = await api.customers.getById(cart.customerId);
        customerTotalArrears = customer?.outstanding_arrear ?? 0;
      }

      const printData = {
        ...sale,
        customer_name: cart.customerName,
        customer_total_arrears: customerTotalArrears,
        payment_method: sale.payment_method || tenderData?.paymentMethod || "CASH",
        cash_amount: sale.cash_amount ?? tenderData?.cashAmount ?? (tenderData?.paymentMethod === "CASH" ? amountPaid : 0),
        card_amount: sale.card_amount ?? tenderData?.cardAmount ?? (tenderData?.paymentMethod === "CARD" ? amountPaid : 0),
        credit_amount: sale.credit_amount ?? tenderData?.creditAmount ?? 0,
        prescription_number: sale.prescription_number || tenderData?.prescriptionNumber,
        cashier_name: sale.cashier_name,
        items: (sale.items && sale.items.length > 0)
          ? sale.items.map((item) => ({
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              batch_number: item.batch_number,
              expiry_date: item.expiry_date,
            }))
          : cart.items.map((item) => ({
              product_name: item.productName,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              subtotal: item.subtotal,
              batch_number: item.batchNumber,
              expiry_date: item.expiryDate,
            })),
      };
      setPendingPrintData(printData);
      setLastReceipt(printData);
      setShowPrintDialog(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      throw e;
    }
  };

  const generateReceiptHtml = useCallback(async (paperSize: string): Promise<string> => {
    if (!pendingPrintData) return "";
    const result = await window.generateReceiptHTML(pendingPrintData, paperSize);
    return result.success ? result.html : "";
  }, [pendingPrintData]);

  async function handlePrintReceipt(config: PrinterConfig) {
    if (!pendingPrintData) return;
    const result = await window.printReceipt(pendingPrintData, config);
    if (!result.success) {
      toast.error(result.error || "Print failed");
    } else {
      toast.success("Receipt printed");
    }
    setPendingPrintData(null);
  }

  return (
    <div className={`flex flex-col gap-3 ${isPosWindow ? "h-[calc(100vh-2.5rem)]" : "h-[calc(100vh-8rem)]"}`}>
      {isPosWindow && (
        <div
          className="drag-region h-6 w-full shrink-0 cursor-grab active:cursor-grabbing flex items-center justify-center gap-2 bg-surface border-b border-border/50 rounded-t-lg -mt-3 -mx-5 lg:-mx-6 px-5 lg:px-6 select-none"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="flex gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <div className="w-1.5 h-1.5 rounded-full bg-text-secondary/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-text-secondary/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-text-secondary/30" />
          </div>
          <span className="text-[9px] text-text-secondary/50 font-medium tracking-wider uppercase" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>Drag to move</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
        <div className="flex-1 min-w-0">
          <PosShiftManager activeShift={activeShift} isLoading={isShiftLoading} />
        </div>
        <button
          onClick={handleNewSale}
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium border border-border/80 bg-surface hover:bg-surface-2 text-text-primary transition-colors shrink-0 self-end sm:self-center shadow-xs"
        >
          <Plus className="h-3.5 w-3.5 text-accent" />
          New Sale
        </button>
      </div>
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        <BarcodeInput value={search} onChange={setSearch} onSubmit={handleBarcodeSubmit} />
        <div className="flex-1 overflow-y-auto mt-3">
          {displayProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-text-secondary">
              {search ? "No products found" : "Search or scan a product to begin"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              <AnimatePresence mode="popLayout">
                {displayProducts.slice(0, 50).map((product: Product) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                  >
                    <ProductCard product={product} onAdd={handleAddProduct} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
      <div className="w-full lg:w-[380px] xl:w-[400px] shrink-0">
        <div className={`lg:sticky bg-surface border border-border rounded-lg p-4 h-full flex flex-col ${isPosWindow ? "lg:top-5 max-h-[calc(100vh-4rem)]" : "lg:top-20 max-h-[calc(100vh-10rem)]"}`}>
          <CheckoutPanel
            items={cart.items}
            discount={cart.discount}
            discountValue={cart.discountValue}
            discountType={cart.discountType}
            subtotal={cart.subtotal}
            total={cart.total}
            customerId={cart.customerId}
            notes={cart.notes}
            amountPaid={cart.amountPaid}
            addToArrears={cart.addToArrears}
            onUpdateQuantity={cart.updateQuantity}
            onIncrementBy={cart.incrementBy}
            onRemoveItem={cart.removeItem}
            onDiscountChange={cart.setDiscountValue}
            onToggleDiscountType={cart.toggleDiscountType}
            onClearCart={cart.clearCart}
            onCheckout={handleCheckout}
            onCustomerChange={cart.setCustomer}
            onNotesChange={cart.setNotes}
            onAmountPaidChange={cart.setAmountPaid}
            onAddToArrearsChange={cart.setAddToArrears}
            error={error}
          />
        </div>
      </div>
      </div>

      <AlertDialog open={pricePickerOpen} onOpenChange={(v) => { if (!v) { setPendingProduct(null); setPricePickerOpen(false); } }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-accent" />
              Packaging & Price Hierarchy
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Select dispensing unit for <span className="font-semibold text-text-primary">{pendingProduct?.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-3 px-1">
            {pendingProduct && getPackagingOptions(pendingProduct).map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleTierSelect(opt)}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors">{opt.label}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface-2 text-text-secondary border border-border">
                      {opt.unitType}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-secondary mt-0.5 block">{opt.description}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-accent text-sm">{formatCurrency(opt.salePrice)}</span>
                  <span className="text-[10px] text-text-secondary block">per {opt.unitType.toLowerCase()}</span>
                </div>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingProduct(null); }}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showPrintDialog && Boolean(pendingPrintData) && (
        <PrintPreviewDialog
          open={showPrintDialog}
          onOpenChange={(v) => {
            setShowPrintDialog(v);
            if (!v) setPendingPrintData(null);
          }}
          title="Receipt Preview"
          htmlGenerator={generateReceiptHtml}
          onPrint={handlePrintReceipt}
        />
      )}
    </div>
  );
}
