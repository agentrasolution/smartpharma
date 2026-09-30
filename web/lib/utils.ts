import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTenantCurrency(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("smartpharma_currency")?.trim();
    if (saved) return saved;
  }
  return "USD";
}

export function formatCurrency(amount: number | null | undefined, currency?: string): string {
  const val = Number(amount ?? 0);
  if (isNaN(val)) return "0.00";
  const curr = currency || getTenantCurrency();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  } catch {
    return `${curr} ${val.toFixed(2)}`;
  }
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
