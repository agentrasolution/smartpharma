import { Trash2, Minus, Plus, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CartItemProps {
  item: {
    id?: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    packSize?: number;
    packagingUnit?: string;
    conversionRatio?: number;
  };
  onUpdateQuantity: (idOrProductId: string, quantity: number) => void;
  onIncrementBy: (idOrProductId: string, amount: number) => void;
  onRemove: (idOrProductId: string) => void;
}

export default function CartItem({ item, onUpdateQuantity, onIncrementBy, onRemove }: CartItemProps) {
  const itemKey = item.id || item.productId;
  const packSize = item.packSize ?? 1;
  const quickBtns = [5, 10, 20];
  const packagingUnit = item.packagingUnit && item.packagingUnit !== "UNIT" ? item.packagingUnit : null;
  const conversionRatio = item.conversionRatio && item.conversionRatio > 1 ? item.conversionRatio : null;
  const packLabel = packSize > 1 ? `${packSize}/pack` : null;

  return (
    <div className="group flex items-center gap-2.5 py-2 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-medium text-text-primary truncate">{item.productName}</p>
          {packagingUnit && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/25">
              {packagingUnit}
            </span>
          )}
        </div>
        <p className="text-[10px] text-text-secondary mt-0.5">
          {formatCurrency(item.unitPrice)} each
          {conversionRatio ? ` · 1 ${packagingUnit || 'Pack'} = ${conversionRatio} units` : (packLabel ? ` · ${packLabel}` : "")}
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          {quickBtns.map((n) => (
            <button
              key={n}
              onClick={() => onIncrementBy(itemKey, n)}
              className="h-5 px-1.5 rounded text-[9px] font-medium text-text-secondary bg-surface-2 hover:bg-border hover:text-text-primary transition-colors"
            >
              +{n}
            </button>
          ))}
          {packSize > 1 && (
            <button
              onClick={() => onIncrementBy(itemKey, packSize)}
              className="h-5 px-1.5 rounded text-[9px] font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors flex items-center gap-0.5"
            >
              <Package className="h-2.5 w-2.5" />+Pack
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdateQuantity(itemKey, item.quantity - 1)}
          disabled={item.quantity <= 1}
          className="h-6 w-6 rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-2 disabled:opacity-30 transition-colors"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-7 text-center text-xs font-semibold font-mono tabular-nums">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(itemKey, item.quantity + 1)}
          className="h-6 w-6 rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div className="text-right min-w-[60px]">
        <p className="text-xs font-semibold font-mono tabular-nums">{formatCurrency(item.subtotal)}</p>
      </div>
      <button
        onClick={() => onRemove(itemKey)}
        className="h-6 w-6 rounded flex items-center justify-center text-text-secondary/40 hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}