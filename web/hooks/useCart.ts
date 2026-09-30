import { useState, useMemo } from "react";
import type { SaleItemInput, DiscountType } from "@/types";

interface CartItem extends SaleItemInput {
  id: string;
  packSize: number;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>("pkr");
  const [customerId, setCustomerIdState] = useState<string | undefined>();
  const [customerName, setCustomerName] = useState<string | undefined>();

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.subtotal, 0), [items]);

  const discount = useMemo(() => {
    if (discountType === "percent") {
      return Math.round(subtotal * discountValue / 100);
    }
    return discountValue;
  }, [subtotal, discountValue, discountType]);

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  function toggleDiscountType() {
    setDiscountType((prev) => {
      if (prev === "pkr") {
        const pct = subtotal > 0 ? Math.round(discountValue * 100 / subtotal) : 0;
        setDiscountValue(Math.min(pct, 100));
        return "percent";
      }
      setDiscountValue(discount);
      return "pkr";
    });
  }

  function addItem(product: { id: string; name: string; barcode: string; sale_price: number; pack_size?: number }) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
            : i
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: 1,
          unitPrice: product.sale_price,
          subtotal: product.sale_price,
          packSize: product.pack_size ?? 1,
        },
      ];
    });
  }

  function incrementBy(productId: string, amount: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: i.quantity + amount, subtotal: (i.quantity + amount) * i.unitPrice }
          : i
      )
    );
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) return removeItem(productId);
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity, subtotal: quantity * i.unitPrice } : i
      )
    );
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function setCustomer(id: string | undefined, name?: string) {
    setCustomerIdState(id);
    setCustomerName(name);
  }

  function clearCart() {
    setItems([]);
    setDiscountValue(0);
    setDiscountType("pkr");
    setCustomerIdState(undefined);
    setCustomerName(undefined);
  }

  return {
    items, discount, discountValue, discountType, subtotal, total, customerId, customerName,
    setCustomer, setDiscountValue, setDiscountType, toggleDiscountType,
    addItem, incrementBy, updateQuantity, removeItem, clearCart,
  };
}
