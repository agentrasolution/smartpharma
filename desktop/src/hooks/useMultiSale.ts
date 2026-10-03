import { useState, useMemo, useCallback } from "react";
import type { SaleItemInput, DiscountType } from "@/types";

export interface CartItem extends SaleItemInput {
  id: string;
  packSize: number;
}

export interface SaleState {
  id: string;
  label: string;
  items: CartItem[];
  discountValue: number;
  discountType: DiscountType;
  customerId?: string;
  customerName?: string;
  notes: string;
  amountPaid: string;
  addToArrears: boolean;
}

let tempCounter = 1;

function createSaleState(seq: number): SaleState {
  const padded = String(seq).padStart(3, "0");
  return {
    id: `SALE-TEMP-${padded}`,
    label: `Sale ${padded}`,
    items: [],
    discountValue: 0,
    discountType: "pkr",
    customerId: undefined,
    customerName: undefined,
    notes: "",
    amountPaid: "",
    addToArrears: false,
  };
}

export function useMultiSale() {
  const [sales, setSales] = useState<SaleState[]>(() => [createSaleState(1)]);
  const [activeId, setActiveId] = useState<string>(`SALE-TEMP-001`);

  const activeSale = useMemo(
    () => sales.find((s) => s.id === activeId) ?? sales[0],
    [sales, activeId]
  );

  const updateActive = useCallback(
    (patch: Partial<SaleState> | ((s: SaleState) => SaleState)) => {
      setSales((prev) =>
        prev.map((s) =>
          s.id === activeId ? (typeof patch === "function" ? patch(s) : { ...s, ...patch }) : s
        )
      );
    },
    [activeId]
  );

  const newSale = useCallback(() => {
    tempCounter += 1;
    const sale = createSaleState(tempCounter);
    setSales((prev) => [...prev, sale]);
    setActiveId(sale.id);
  }, []);

  const switchSale = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const closeSale = useCallback(
    (id: string) => {
      const idx = sales.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const next = sales.filter((s) => s.id !== id);
      if (next.length === 0) {
        tempCounter += 1;
        const fresh = createSaleState(tempCounter);
        setActiveId(fresh.id);
        setSales([fresh]);
        return;
      }
      setActiveId((current) =>
        current === id ? next[Math.min(idx, next.length - 1)].id : current
      );
      setSales(next);
    },
    [sales]
  );

  const subtotal = useMemo(
    () => activeSale.items.reduce((s, i) => s + i.subtotal, 0),
    [activeSale.items]
  );

  const discount = useMemo(() => {
    if (activeSale.discountType === "percent") {
      return Math.round((subtotal * activeSale.discountValue) / 100);
    }
    return activeSale.discountValue;
  }, [subtotal, activeSale.discountValue, activeSale.discountType]);

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  const toggleDiscountType = useCallback(() => {
    updateActive((s) => {
      let value = s.discountValue;
      let type: DiscountType = s.discountType;
      if (type === "pkr") {
        const pct = subtotal > 0 ? Math.round((s.discountValue * 100) / subtotal) : 0;
        value = Math.min(pct, 100);
        type = "percent";
      } else {
        value = discount;
        type = "pkr";
      }
      return { ...s, discountValue: value, discountType: type };
    });
  }, [updateActive, subtotal, discount]);

  const addItem = useCallback(
    (
      product: { id: string; name: string; barcode: string; sale_price: number; pack_size?: number },
      packagingOpts?: {
        packagingUnit?: string;
        conversionRatio?: number;
        unitPrice?: number;
      }
    ) => {
      const packagingUnit = packagingOpts?.packagingUnit || "UNIT";
      const conversionRatio = packagingOpts?.conversionRatio && packagingOpts.conversionRatio > 0 ? packagingOpts.conversionRatio : 1;
      const unitPrice = packagingOpts?.unitPrice != null ? packagingOpts.unitPrice : product.sale_price;

      updateActive((s) => {
        const existing = s.items.find(
          (i) => i.productId === product.id && (i.packagingUnit || "UNIT") === packagingUnit
        );
        if (existing) {
          return {
            ...s,
            items: s.items.map((i) =>
              i.id === existing.id
                ? {
                    ...i,
                    quantity: i.quantity + 1,
                    quantityBaseUnits: (i.quantity + 1) * (i.conversionRatio || 1),
                    subtotal: (i.quantity + 1) * i.unitPrice,
                  }
                : i
            ),
          };
        }
        return {
          ...s,
          items: [
            ...s.items,
            {
              id: crypto.randomUUID(),
              productId: product.id,
              productName: product.name,
              barcode: product.barcode,
              quantity: 1,
              packagingUnit,
              conversionRatio,
              quantityBaseUnits: conversionRatio,
              unitPrice,
              subtotal: unitPrice,
              packSize: product.pack_size ?? 1,
            },
          ],
        };
      });
    },
    [updateActive]
  );

  const incrementBy = useCallback(
    (idOrProductId: string, amount: number) => {
      updateActive((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.id === idOrProductId || i.productId === idOrProductId
            ? {
                ...i,
                quantity: i.quantity + amount,
                quantityBaseUnits: (i.quantity + amount) * (i.conversionRatio || 1),
                subtotal: (i.quantity + amount) * i.unitPrice,
              }
            : i
        ),
      }));
    },
    [updateActive]
  );

  const removeItem = useCallback(
    (idOrProductId: string) => {
      updateActive((s) => ({
        ...s,
        items: s.items.filter((i) => i.id !== idOrProductId && i.productId !== idOrProductId),
      }));
    },
    [updateActive]
  );

  const updateQuantity = useCallback(
    (idOrProductId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(idOrProductId);
        return;
      }
      updateActive((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.id === idOrProductId || i.productId === idOrProductId
            ? {
                ...i,
                quantity,
                quantityBaseUnits: quantity * (i.conversionRatio || 1),
                subtotal: quantity * i.unitPrice,
              }
            : i
        ),
      }));
    },
    [updateActive, removeItem]
  );

  const setCustomer = useCallback(
    (id?: string, name?: string) => {
      updateActive({ customerId: id, customerName: name });
    },
    [updateActive]
  );

  const setDiscountValue = useCallback(
    (value: number) => updateActive({ discountValue: value }),
    [updateActive]
  );

  const setDiscountType = useCallback(
    (value: DiscountType) => updateActive({ discountType: value }),
    [updateActive]
  );

  const setNotes = useCallback(
    (notes: string) => updateActive({ notes }),
    [updateActive]
  );

  const setAmountPaid = useCallback(
    (amountPaid: string) => updateActive({ amountPaid }),
    [updateActive]
  );

  const setAddToArrears = useCallback(
    (addToArrears: boolean) => updateActive({ addToArrears }),
    [updateActive]
  );

  const clearCart = useCallback(() => {
    updateActive({
      items: [],
      discountValue: 0,
      discountType: "pkr",
      customerId: undefined,
      customerName: undefined,
      notes: "",
      amountPaid: "",
      addToArrears: false,
    });
  }, [updateActive]);

  return {
    items: activeSale.items,
    discount,
    discountValue: activeSale.discountValue,
    discountType: activeSale.discountType,
    subtotal,
    total,
    customerId: activeSale.customerId,
    customerName: activeSale.customerName,
    notes: activeSale.notes,
    amountPaid: activeSale.amountPaid,
    addToArrears: activeSale.addToArrears,
    setCustomer,
    setDiscountValue,
    setDiscountType,
    toggleDiscountType,
    addItem,
    incrementBy,
    updateQuantity,
    removeItem,
    clearCart,
    setNotes,
    setAmountPaid,
    setAddToArrears,
    sales,
    activeSale,
    activeId,
    newSale,
    switchSale,
    closeSale,
  };
}
