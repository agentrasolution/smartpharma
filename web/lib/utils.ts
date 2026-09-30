import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import JsBarcode from "jsbarcode";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface RenderBarcodeOptions {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
}

export function renderBarcode(svg: SVGElement, value: string, options: RenderBarcodeOptions = {}): boolean {
  const opts = {
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 14,
    margin: 8,
    ...options,
  };
  try {
    JsBarcode(svg, value, { format: "EAN13", ...opts });
    return true;
  } catch {
    try {
      JsBarcode(svg, value, { format: "CODE128", ...opts });
      return true;
    } catch {
      return false;
    }
  }
}

export function getTenantCurrency(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("smartpharma_currency")?.trim();
    if (saved) return saved;
  }
  return "SAR";
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

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateBarcode(): string {
  const digits = "890" + Math.random().toString().slice(2, 11);
  return addEAN13CheckDigit(digits);
}

export function addEAN13CheckDigit(code: string): string {
  const d = code.replace(/\D/g, "").slice(0, 12);
  if (d.length < 12) return code;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(d[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return d + check;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
