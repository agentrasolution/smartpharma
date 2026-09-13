import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, User, Boxes, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency } from "@/lib/utils";
import type { Product, Customer, StockPurchase } from "@/types";

interface SearchResult {
  type: "product" | "customer" | "stock";
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  onClick: () => void;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 200);

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["global-search-products", debouncedQuery],
    queryFn: () => api.products.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ["global-search-customers", debouncedQuery],
    queryFn: () => api.customers.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: stock = [], isLoading: loadingStock } = useQuery({
    queryKey: ["global-search-stock"],
    queryFn: api.stock.list,
    enabled: debouncedQuery.length >= 2,
  });

  const isLoading = loadingProducts || loadingCustomers || loadingStock;

  const stockResults = stock.filter(
    (s) =>
      s.product_name?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      s.invoice_number?.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  const results: SearchResult[] = [];

  products.slice(0, 5).forEach((p) => {
    results.push({
      type: "product",
      id: p.id,
      title: p.name,
      subtitle: p.barcode,
      meta: `Stock: ${p.stock_qty} | ${formatCurrency(p.sale_price)}`,
      onClick: () => {
        navigate("/products");
        setIsOpen(false);
        setQuery("");
      },
    });
  });

  customers.slice(0, 3).forEach((c) => {
    results.push({
      type: "customer",
      id: c.id,
      title: c.name,
      subtitle: c.phone || "No phone",
      meta: c.outstanding_arrear ? `Arrear: ${formatCurrency(c.outstanding_arrear)}` : undefined,
      onClick: () => {
        navigate(`/customers/${c.id}`);
        setIsOpen(false);
        setQuery("");
      },
    });
  });

  stockResults.slice(0, 3).forEach((s) => {
    results.push({
      type: "stock",
      id: s.id,
      title: s.product_name || "Unknown",
      subtitle: s.distributor_name || "No distributor",
      meta: `Qty: ${s.quantity} | ${formatCurrency(s.purchase_price)}`,
      onClick: () => {
        navigate("/stock");
        setIsOpen(false);
        setQuery("");
      },
    });
  });

  const handleSelect = useCallback(
    (index: number) => {
      if (results[index]) {
        results[index].onClick();
      }
    },
    [results]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        handleSelect(selectedIndex);
        break;
      case "Escape":
        setIsOpen(false);
        setQuery("");
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const showDropdown = isOpen && debouncedQuery.length >= 2;
  const hasResults = results.length > 0;

  const typeIcons = {
    product: Package,
    customer: User,
    stock: Boxes,
  };

  const typeLabels = {
    product: "Products",
    customer: "Customers",
    stock: "Stock",
  };

  const groupedResults = results.reduce(
    (acc, result, index) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push({ ...result, originalIndex: index });
      return acc;
    },
    {} as Record<string, (SearchResult & { originalIndex: number })[]>
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-text-secondary pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search products, customers..."
          className="h-9 w-80 pl-10 pr-14 rounded-xl border-2 border-accent/30 bg-accent/5 text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
        />
        <kbd className="absolute right-2.5 pointer-events-none h-5 px-1.5 rounded border border-border bg-surface text-[10px] text-text-secondary font-medium">
          ⌘K
        </kbd>
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50 max-h-[420px] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Searching...</span>
            </div>
          )}

          {!isLoading && !hasResults && (
            <div className="py-8 text-center">
              <p className="text-xs text-text-secondary">No results found for "{debouncedQuery}"</p>
            </div>
          )}

          {!isLoading && hasResults && (
            <div className="py-2">
              {Object.entries(groupedResults).map(([type, items]) => {
                const Icon = typeIcons[type as keyof typeof typeIcons];
                return (
                  <div key={type}>
                    <div className="px-4 py-2 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-text-secondary/60" />
                      <span className="text-[11px] font-medium text-text-secondary/60 uppercase tracking-wider">
                        {typeLabels[type as keyof typeof typeLabels]}
                      </span>
                    </div>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={item.onClick}
                        onMouseEnter={() => setSelectedIndex(item.originalIndex)}
                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                          selectedIndex === item.originalIndex
                            ? "bg-accent/10 text-accent"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          selectedIndex === item.originalIndex
                            ? "bg-accent/20"
                            : "bg-muted"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.title}</p>
                          <p className="text-[11px] text-text-secondary truncate">{item.subtitle}</p>
                        </div>
                        {item.meta && (
                          <span className="text-[11px] text-text-secondary tabular-nums shrink-0">
                            {item.meta}
                          </span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-text-secondary/40 shrink-0" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
