import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
  const lowStock = product.stock_qty <= 5;
  const outOfStock = product.stock_qty === 0;

  return (
    <motion.button
      whileHover={outOfStock ? undefined : { y: -1 }}
      whileTap={outOfStock ? undefined : { scale: 0.99 }}
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`w-full text-left rounded-lg border bg-surface p-3.5 relative transition-all ${
        outOfStock
          ? "border-danger/20 opacity-50 cursor-not-allowed"
          : "border-border hover:border-accent/30 hover:shadow-sm cursor-pointer"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            outOfStock ? "bg-danger" : lowStock ? "bg-warning" : "bg-success"
          }`}
        />
        <span className="text-[9px] font-medium text-text-secondary tracking-wider">
          {outOfStock ? "OUT OF STOCK" : lowStock ? `Only ${product.stock_qty} left` : "In Stock"}
        </span>
      </div>
      <h3 className="font-display font-semibold text-sm text-text-primary leading-tight">{product.name}</h3>
      <p className="text-[10px] text-text-secondary mt-0.5 truncate">{product.company}</p>
      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
        <span className="font-mono font-bold text-sm text-text-primary tabular-nums">{formatCurrency(product.sale_price)}</span>
        <span className="text-[9px] text-text-secondary font-medium">{product.pack_size > 1 ? `${product.pack_size}/pack` : "1x"}</span>
      </div>
    </motion.button>
  );
}
