import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import BarcodeInput from "@/components/pos/BarcodeInput";
import ProductCard from "@/components/pos/ProductCard";
import CheckoutPanel from "@/components/pos/CheckoutPanel";
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
import { Plus } from "lucide-react";
import type { Product, PrinterConfig, ProductPrice } from "@/types";

export default function POS() {
  const location = useLocation();
  const isPosWindow = new URLSearchParams(location.search).has("pos");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const debouncedSearch = useDebounce(search, 200);
  const cart = useMultiSale();
  const queryClient = useQueryClient();

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

  function addProductToCart(product: Product, salePrice: number) {
    if (product.stock_qty === 0) {
      setError(`${product.name} is out of stock`);
      return;
    }
    cart.addItem({ ...product, sale_price: salePrice });
  }

  function promptPriceTier(product: Product) {
    const tiers = (product as any).prices as ProductPrice[] | undefined;
    if (tiers && tiers.length > 0) {
      setPendingProduct(product);
      setPricePickerOpen(true);
    } else {
      addProductToCart(product, product.sale_price);
    }
  }

  function handleTierSelect(tierSalePrice: number) {
    if (!pendingProduct) return;
    addProductToCart(pendingProduct, tierSalePrice);
    setPendingProduct(null);
    setPricePickerOpen(false);
  }

  const handleBarcodeSubmit = async (value: string) => {
    const product = await api.products.getByBarcode(value);
    if (product) {
      const existing = cart.items.find(i => i.productId === product.id);
      if (existing) {
        cart.incrementBy(product.id, product.pack_size);
        return;
      }
      promptPriceTier(product);
    } else {
      const found = displayProducts.find(
        (p: Product) => p.barcode === value || p.name.toLowerCase() === value.toLowerCase()
      );
      if (found) {
        const existing = cart.items.find(i => i.productId === found.id);
        if (existing) {
          cart.incrementBy(found.id, found.pack_size);
          return;
        }
        promptPriceTier(found);
      }
    }
  };

  const handleAddProduct = (product: Product) => {
    if (product.stock_qty === 0) {
      setError(`${product.name} is out of stock`);
      return;
    }
    const existing = cart.items.find(i => i.productId === product.id);
    if (existing) {
      cart.incrementBy(product.id, product.pack_size);
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
    window.open(`${window.location.origin}${window.location.pathname}#/pos?pos=1`, "_blank");
  };

  const handleCheckout = async (amountPaid: number, discount: number) => {
    setError("");
    try {
      const sale = await api.sales.create({
        customerId: cart.customerId,
        items: cart.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
        subtotal: cart.subtotal,
        discount,
        total: cart.total,
        amountPaid,
      });

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });

      let customerTotalArrears = 0;
      if (cart.customerId) {
        const customer = await api.customers.getById(cart.customerId);
        customerTotalArrears = customer?.outstanding_arrear ?? 0;
      }

      const printData = {
        ...sale,
        customer_name: cart.customerName,
        customer_total_arrears: customerTotalArrears,
        items: cart.items.map((item) => ({
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
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
      <div className="flex justify-end shrink-0">
        <button
          onClick={handleNewSale}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-accent text-accent-foreground hover:bg-accent-hover transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Price Tier</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingProduct?.name ?? "Product"} has multiple price tiers. Choose one to add to cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-3 px-5">
            <button
              onClick={() => pendingProduct && handleTierSelect(pendingProduct.sale_price ?? 0)}
              className="w-full text-left p-2.5 rounded-lg border border-border hover:border-accent/50 transition-colors flex items-center justify-between"
            >
              <span className="text-xs font-medium">Standard</span>
              <span className="font-mono font-bold text-accent text-xs">{formatCurrency(pendingProduct?.sale_price ?? 0)}</span>
            </button>
            {pendingPrices?.map((tier) => (
              <button
                key={tier.id}
                onClick={() => handleTierSelect(tier.salePrice)}
                className="w-full text-left p-2.5 rounded-lg border border-border hover:border-accent/50 transition-colors flex items-center justify-between"
              >
                <span className="text-xs font-medium">{tier.label || "Untitled"}</span>
                <span className="font-mono font-bold text-accent text-xs">{formatCurrency(tier.salePrice)}</span>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingProduct(null); }}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showPrintDialog && pendingPrintData && (
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
