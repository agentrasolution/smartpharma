import { useCallback, useMemo, useState } from 'react';

import type { DiscountType, Product, SaleItemInput } from '@/types';

export interface CartItemData extends SaleItemInput {
  id: string;
  packSize: number;
}

export interface UseCartResult {
  items: CartItemData[];
  subtotal: number;
  discount: number;
  discountValue: number;
  discountType: DiscountType;
  total: number;
  customerId?: string;
  customerName?: string;
  addToArrears: boolean;
  addProduct: (product: Product, salePrice: number) => void;
  incrementBy: (productId: string, amount: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  setCustomer: (id?: string, name?: string) => void;
  setDiscountValue: (value: number) => void;
  toggleDiscountType: () => void;
  setAddToArrears: (value: boolean) => void;
  clearCart: () => void;
}

let itemCounter = 1;

export function useCart(): UseCartResult {
  const [items, setItems] = useState<CartItemData[]>([]);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>('pkr');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [customerName, setCustomerName] = useState<string | undefined>(undefined);
  const [addToArrears, setAddToArrears] = useState(false);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.subtotal, 0), [items]);

  const discount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.round((subtotal * discountValue) / 100);
    }
    return discountValue;
  }, [subtotal, discountValue, discountType]);

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  const addProduct = useCallback((product: Product, salePrice: number) => {
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
          id: `item-${itemCounter++}`,
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: 1,
          unitPrice: salePrice,
          subtotal: salePrice,
          packSize: product.pack_size ?? 1,
        },
      ];
    });
  }, []);

  const incrementBy = useCallback((productId: string, amount: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: i.quantity + amount, subtotal: (i.quantity + amount) * i.unitPrice }
          : i
      )
    );
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity, subtotal: quantity * i.unitPrice } : i
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const setCustomer = useCallback((id?: string, name?: string) => {
    setCustomerId(id);
    setCustomerName(name);
  }, []);

  const toggleDiscountType = useCallback(() => {
    setDiscountType((prevType) => {
      if (prevType === 'pkr') {
        const pct = subtotal > 0 ? Math.round((discountValue * 100) / subtotal) : 0;
        setDiscountValue(Math.min(Math.max(pct, 0), 100));
        return 'percent';
      }
      setDiscountValue(discount);
      return 'pkr';
    });
  }, [subtotal, discountValue, discount]);

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscountValue(0);
    setDiscountType('pkr');
    setCustomerId(undefined);
    setCustomerName(undefined);
    setAddToArrears(false);
  }, []);

  return {
    items,
    subtotal,
    discount,
    discountValue,
    discountType,
    total,
    customerId,
    customerName,
    addToArrears,
    addProduct,
    incrementBy,
    updateQuantity,
    removeItem,
    setCustomer,
    setDiscountValue,
    toggleDiscountType,
    setAddToArrears,
    clearCart,
  };
}