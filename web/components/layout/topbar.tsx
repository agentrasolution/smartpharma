"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sun, Moon, Wifi, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import GlobalSearch from "@/components/shared/GlobalSearch";

const pageLabels: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Business overview & metrics" },
  "/dashboard": { title: "Dashboard", subtitle: "Business overview & metrics" },
  "/pos": { title: "Point of Sale", subtitle: "Create sales, scan items & issue receipts" },
  "/dispensing": { title: "Dispensing & Rx", subtitle: "Clinical prescription verification & dispensing" },
  "/products": { title: "Products Master", subtitle: "Drug catalog, dosages & retail pricing" },
  "/barcodes": { title: "Barcodes", subtitle: "Custom barcode label generation & printing" },
  "/stock": { title: "Purchasing", subtitle: "Supplier purchase orders & invoice receiving" },
  "/inventory": { title: "Inventory & Batches", subtitle: "FEFO batch lifecycle, expiry alerts & quarantine" },
  "/customers": { title: "Customers & Patients", subtitle: "Patient profiles, medical consent & chronic refills" },
  "/invoices": { title: "Sales Invoices", subtitle: "Historical transactions & receipt reprinting" },
  "/arrears": { title: "Customer Arrears", subtitle: "Credit balances & accounts receivable" },
  "/distributors": { title: "Distributors", subtitle: "Supplier management & accounts payable" },
  "/companies": { title: "Companies", subtitle: "Pharmaceutical manufacturers & vendors" },
  "/categories": { title: "Categories", subtitle: "Product category taxonomy" },
  "/returns": { title: "Customer Returns", subtitle: "Merchandise returns & inventory restocking" },
  "/expenses": { title: "Expenses", subtitle: "Operational expense ledger & tracking" },
  "/reports": { title: "Financial Reports", subtitle: "Profit & Loss, margins, shrinkage & valuation" },
  "/settings": { title: "System Settings", subtitle: "Pharmacy configuration, VAT & printers" },
  "/users": { title: "User Management", subtitle: "Staff accounts & branch assignments" },
  "/roles": { title: "Roles & Permissions", subtitle: "Role-based access control matrix" },
  "/branches": { title: "Branch Operations", subtitle: "Multi-branch inventory & stock transfers" },
  "/billing": { title: "Subscription & Billing", subtitle: "Plan details & billing history" },
  "/change-password": { title: "Change Password", subtitle: "Update your account password" },
  "/ai": { title: "AI Inventory", subtitle: "Intelligent analytics & autonomous insights" },
  "/ai/recommendations": { title: "AI Recommendations", subtitle: "Automated replenishment proposals" },
  "/ai/chat": { title: "AI Assistant", subtitle: "Pharmacy ERP Copilot & natural language querying" },
  "/ai/approvals": { title: "AI Approvals", subtitle: "Supervisor review & batch purchase actions" },
  "/ai/activity": { title: "AI Audit Log", subtitle: "System automated decisions & history" },
  "/settings/ai": { title: "AI LLM Providers", subtitle: "Configure OpenAI, Anthropic, or Ollama" },
  "/platform": { title: "Platform Console", subtitle: "Multi-tenant pharmacies & subscriptions" },
};

export default function Topbar() {
  const pathname = usePathname();
  const [time, setTime] = useState("");
  const [dark, setDark] = useState(false);
  const { user } = useAuth();
  const isPlatform = user?.role === "platform";

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("smartpharma_theme", next ? "dark" : "light");
    } catch {}
  }

  // Get matching page metadata or fallback
  const baseKey = Object.keys(pageLabels).find(key => key !== "/" && pathname.startsWith(key)) || (pathname === "/" ? "/" : "");
  const page = pageLabels[baseKey] || { title: "SmartPharma ERP", subtitle: "Healthcare management platform" };

  return (
    <header className="h-14 border-b border-border bg-surface/70 backdrop-blur-lg sticky top-0 z-20 flex-shrink-0">
      <div className="flex items-center justify-between h-full px-6">
        {/* Page Title & Breadcrumb */}
        <div className="flex items-center gap-6">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
          >
            <h1 className="text-sm font-semibold text-text-primary tracking-tight leading-tight">{page.title}</h1>
            <p className="text-[11px] text-text-secondary leading-none mt-0.5">{page.subtitle}</p>
          </motion.div>

          {!isPlatform && <GlobalSearch />}
        </div>

        {/* Right Section: Time, Online Status, Theme Toggle */}
        <div className="flex items-center gap-3">
          {/* Live Clock */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border/60 text-xs font-mono text-text-secondary">
            <Clock className="h-3.5 w-3.5 text-text-secondary" />
            <span suppressHydrationWarning>{time || "—"}</span>
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20 text-xs font-medium text-success">
            <Wifi className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Online</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleDark}
            className="h-8 w-8 rounded-lg border border-border bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-all cursor-pointer"
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
