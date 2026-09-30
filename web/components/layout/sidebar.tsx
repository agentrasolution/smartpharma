"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Boxes, Users, CreditCard,
  Factory, Building2, Tags, Undo2, Wallet, BarChart3, Receipt, Barcode, Settings,
  LogOut, PanelLeftClose, BrainCircuit, ListChecks, MessageSquare, ShieldCheck, Activity, ScanLine,
  UserCog, KeyRound, Store, Globe, ChevronDown, MoreVertical, Command, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { JOB_ROLE_LABELS } from "@/types";
import { api } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  roles?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const tenantNavSections: NavSection[] = [
  {
    title: "Home",
    items: [
      { href: "/dashboard", label: "Analytics & Overview", icon: LayoutDashboard },
      { href: "/reports", label: "Financial Reports", icon: BarChart3, badge: "Beta", badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    ],
  },
  {
    title: "Services",
    items: [
      { href: "/pos", label: "Point of Sale", icon: ShoppingCart },
      { href: "/dispensing", label: "Dispensing & Rx", icon: FileText },
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/returns", label: "Returns", icon: Undo2 },
      { href: "/customers", label: "Customers & Patients", icon: Users },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/products", label: "Products Master", icon: Package },
      { href: "/stock", label: "Purchasing", icon: Boxes },
      { href: "/inventory", label: "Inventory & Batches", icon: ScanLine },
      { href: "/barcodes", label: "Barcodes", icon: Barcode },
      { href: "/distributors", label: "Distributors", icon: Factory },
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/categories", label: "Categories", icon: Tags },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/arrears", label: "Customer Arrears", icon: CreditCard },
      { href: "/expenses", label: "Expenses", icon: Wallet },
      { href: "/billing", label: "Subscription & Billing", icon: CreditCard, roles: ["admin", "owner"] },
    ],
  },
  {
    title: "AI Copilot",
    items: [
      { href: "/ai", label: "AI Overview", icon: BrainCircuit },
      { href: "/ai/recommendations", label: "AI Recommendations", icon: ListChecks },
      { href: "/ai/chat", label: "AI Chat Assistant", icon: MessageSquare },
      { href: "/ai/approvals", label: "AI Approvals", icon: ShieldCheck },
      { href: "/ai/activity", label: "AI Audit Log", icon: Activity },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/users", label: "Team & Staff", icon: UserCog, roles: ["admin", "owner"] },
      { href: "/roles", label: "Roles & Permissions", icon: KeyRound, roles: ["admin", "owner"] },
      { href: "/branches", label: "Branches", icon: Store, roles: ["admin", "owner", "manager"] },
      { href: "/settings/ai", label: "LLM Providers", icon: BrainCircuit, roles: ["admin", "owner"] },
      { href: "/settings", label: "System Settings", icon: Settings },
    ],
  },
];

const platformNavSections: NavSection[] = [
  {
    title: "Platform",
    items: [
      { href: "/platform", label: "Registered Pharmacies", icon: Globe },
      { href: "/platform", label: "Subscriptions", icon: CreditCard },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [posWindowCount, setPosWindowCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const isPlatform = user?.role === "platform";

  // Filter sections by role
  const sections = useMemo(() => {
    if (isPlatform) return platformNavSections;
    const currentRole = (user?.role || "admin").toLowerCase();
    const currentJob = (user?.jobRole || "").toLowerCase();

    return tenantNavSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!item.roles) return true;
          if (currentRole === "admin" || currentRole === "owner") return true;
          if (item.roles.includes(currentRole)) return true;
          if (currentJob && item.roles.includes(currentJob)) return true;
          return false;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [isPlatform, user?.role, user?.jobRole]);

  const fetchWindowCount = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && window.getPosWindowCount) {
        const count = await window.getPosWindowCount();
        setPosWindowCount(count);
      }
    } catch {}
  }, []);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const orders = await api.purchaseOrders.list({ status: "PENDING_APPROVAL" });
      setPendingApprovals(orders?.length ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchWindowCount();
  }, [fetchWindowCount]);

  useEffect(() => {
    if (isPlatform) return;
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingApprovals, isPlatform]);

  return (
    <aside
      className={cn(
        "h-full bg-surface flex flex-col shrink-0 transition-all duration-300 ease-out relative select-none border-r border-border/80 z-20",
        collapsed ? "w-[68px]" : "w-[245px]"
      )}
    >
      {/* ======================================================== */}
      {/* MOYASAR BRAND HEADER & ACCOUNT SWITCHER                  */}
      {/* ======================================================== */}
      <div
        className={cn(
          "flex items-center h-16 relative border-b border-border/60 transition-all",
          collapsed ? "justify-center px-2" : "px-4 justify-between"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Minimalist Geometric Infinity / Cross Brand Logo */}
          <div className="flex items-center justify-center rounded-xl h-9 w-9 bg-primary/10 text-primary border border-primary/20 shrink-0 font-bold shadow-2xs">
            <svg
              className="h-5 w-5 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M2 12h20M7 7l10 10M17 7L7 17" />
            </svg>
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 overflow-hidden text-left"
              >
                <p className="text-sm font-bold text-text-primary truncate tracking-tight leading-tight">
                  {isPlatform ? "Platform Console" : "SmartPharma"}
                </p>
                <div
                  onClick={() => router.push("/branches")}
                  className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-primary transition-colors cursor-pointer mt-0.5"
                >
                  <span className="truncate">{user?.branchName || "Main Branch"}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Moyasar Shortcut Pill: ctrl k */}
        {!collapsed && (
          <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-text-secondary bg-surface-2 rounded-md border border-border">
            <span>ctrl</span>
            <span>k</span>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* CATEGORIZED NAVIGATION SECTIONS                          */}
      {/* ======================================================== */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin" data-sidebar>
        {sections.map((section, sIdx) => (
          <div key={section.title} className="space-y-0.5">
            {/* Section Category Title */}
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary/60 select-none"
                >
                  {section.title}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Section Items */}
            {section.items.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "group relative flex items-center w-full rounded-xl transition-all duration-150 cursor-pointer",
                    collapsed ? "justify-center h-9" : "gap-3 px-3 h-9",
                    isActive
                      ? "bg-surface-2 text-text-primary font-semibold shadow-2xs"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2/60"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-primary" />
                  )}
                  <Icon
                    className={cn(
                      "shrink-0",
                      collapsed ? "h-4 w-4" : "h-4 w-4",
                      isActive ? "text-primary" : "text-text-secondary group-hover:text-text-primary"
                    )}
                  />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs truncate flex-1 text-left"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Badges (e.g. Beta pill or pending approval count) */}
                  {!collapsed && item.badge && (
                    <span
                      className={cn(
                        "text-[9px] font-semibold px-1.5 py-0.2 rounded-full border",
                        item.badgeColor || "bg-primary/10 text-primary border-primary/20"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}

                  {item.href === "/ai/approvals" && pendingApprovals > 0 && (
                    <span
                      className={cn(
                        "flex items-center justify-center rounded-full bg-amber-500/20 text-amber-600 text-[10px] font-bold h-4 min-w-4 px-1 border border-amber-500/30",
                        collapsed ? "absolute top-1 right-1" : "ml-auto"
                      )}
                    >
                      {pendingApprovals}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ======================================================== */}
      {/* MOYASAR USER PROFILE FOOTER                              */}
      {/* ======================================================== */}
      <div className="border-t border-border/70 p-3 relative bg-surface-2/30">
        <div
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            "flex items-center rounded-xl p-2 hover:bg-surface-2 transition-colors cursor-pointer",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar or 3-dots icon */}
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
              {user?.username ? user.username.slice(0, 2).toUpperCase() : "SP"}
            </div>

            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="min-w-0 overflow-hidden text-left"
                >
                  <p className="text-xs font-semibold text-text-primary truncate leading-tight">
                    {user?.username || "Admin"}
                  </p>
                  <p className="text-[10px] text-text-secondary truncate mt-0.5">
                    {isPlatform ? "Platform Admin" : "SmartPharma Central"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!collapsed && (
            <MoreVertical className="h-3.5 w-3.5 text-text-secondary opacity-60 hover:opacity-100" />
          )}
        </div>

        {/* Quick User Menu Dropdown */}
        {menuOpen && !collapsed && (
          <div className="absolute bottom-16 left-3 right-3 bg-surface border border-border rounded-xl shadow-lg p-1.5 space-y-1 z-50 text-xs">
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/change-password");
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-text-primary hover:bg-surface-2 transition-colors text-left cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5 text-text-secondary" />
              Change Password
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/settings");
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-text-primary hover:bg-surface-2 transition-colors text-left cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5 text-text-secondary" />
              Preferences
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors text-left cursor-pointer font-medium"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Collapse/Expand Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-16 h-6 w-6 rounded-full border border-border bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-all duration-200 z-30 shadow-xs cursor-pointer",
          "hover:scale-105 active:scale-95",
          collapsed && "rotate-180"
        )}
        aria-label="Toggle sidebar"
      >
        <PanelLeftClose className="h-3 w-3" />
      </button>
    </aside>
  );
}
