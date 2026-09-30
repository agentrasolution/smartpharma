"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Boxes, Users, CreditCard,
  Factory, Building2, Tags, Undo2, Wallet, BarChart3, Receipt, Barcode, Settings,
  LogOut, PanelLeftClose, BrainCircuit, ListChecks, MessageSquare, ShieldCheck, Activity, ScanLine,
  UserCog, KeyRound, Store, Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { JOB_ROLE_LABELS } from "@/types";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles?: string[]; // If specified, only these roles can see it
  requiredPerm?: string;
}

const allTenantNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "owner", "manager"] },
  { href: "/pos", label: "POS / Sales", icon: ShoppingCart },
  { href: "/dispensing", label: "Dispensing & Rx", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/returns", label: "Returns", icon: Undo2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/arrears", label: "Arrears", icon: CreditCard, roles: ["admin", "owner", "manager", "cashier"] },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock", label: "Purchasing", icon: Boxes, roles: ["admin", "owner", "manager", "stock_manager"] },
  { href: "/inventory", label: "Inventory", icon: ScanLine, roles: ["admin", "owner", "manager", "stock_manager"] },
  { href: "/barcodes", label: "Barcodes", icon: Barcode, roles: ["admin", "owner", "manager", "stock_manager"] },
  { href: "/distributors", label: "Distributors", icon: Factory, roles: ["admin", "owner", "manager", "stock_manager"] },
  { href: "/companies", label: "Companies", icon: Building2, roles: ["admin", "owner", "manager", "stock_manager"] },
  { href: "/categories", label: "Categories", icon: Tags, roles: ["admin", "owner", "manager", "stock_manager"] },
  { href: "/expenses", label: "Expenses", icon: Wallet, roles: ["admin", "owner", "manager"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "owner", "manager"] },
  { href: "/ai", label: "AI Inventory", icon: BrainCircuit, roles: ["admin", "owner", "manager"] },
  { href: "/ai/recommendations", label: "AI Recommendations", icon: ListChecks, roles: ["admin", "owner", "manager"] },
  { href: "/ai/chat", label: "AI Chat", icon: MessageSquare, roles: ["admin", "owner", "manager"] },
  { href: "/ai/approvals", label: "AI Approvals", icon: ShieldCheck, roles: ["admin", "owner", "manager"] },
  { href: "/ai/activity", label: "AI Activity", icon: Activity, roles: ["admin", "owner", "manager"] },
  { href: "/billing", label: "Subscription & Billing", icon: CreditCard, roles: ["admin", "owner"] },
  { href: "/users", label: "Users", icon: UserCog, roles: ["admin", "owner"] },
  { href: "/roles", label: "Roles", icon: KeyRound, roles: ["admin", "owner"] },
  { href: "/branches", label: "Branches", icon: Store, roles: ["admin", "owner", "manager"] },
  { href: "/settings/ai", label: "LLM Providers", icon: BrainCircuit, roles: ["admin", "owner"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "owner", "manager"] },
];

const platformNavItems: NavItem[] = [
  { href: "/platform", label: "Registered Pharmacies", icon: Globe },
  { href: "/platform", label: "Subscriptions", icon: CreditCard },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [posWindowCount, setPosWindowCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const isPlatform = user?.role === "platform";

  // Filter items based on user role and jobRole
  const navItems = useMemo(() => {
    if (isPlatform) return platformNavItems;
    const currentRole = (user?.role || "admin").toLowerCase();
    const currentJob = (user?.jobRole || "").toLowerCase();

    return allTenantNavItems.filter((item) => {
      if (!item.roles) return true;
      if (currentRole === "admin" || currentRole === "owner") return true;
      if (item.roles.includes(currentRole)) return true;
      if (currentJob && item.roles.includes(currentJob)) return true;
      return false;
    });
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

  const handleNewSale = async () => {
    try {
      if (typeof window !== "undefined" && window.openPosWindow) {
        const result = await window.openPosWindow();
        if (!result.success) {
          router.push("/pos");
        }
      } else {
        router.push("/pos");
      }
    } catch {
      router.push("/pos");
    }
  };

  return (
    <aside
      className={cn(
        "h-full bg-sidebar-background flex flex-col shrink-0 transition-all duration-300 ease-out relative select-none border-r border-sidebar-border z-20",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Brand Header */}
      <div className={cn(
        "flex items-center h-14 relative border-b border-sidebar-border/40",
        collapsed ? "justify-center" : "px-4 gap-3"
      )}>
        <div className="flex items-center justify-center rounded-lg h-9 w-9 bg-primary/10 text-primary shrink-0 font-bold">
          SP
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="min-w-0 overflow-hidden"
            >
              <p className="text-sm font-semibold text-sidebar-foreground truncate tracking-tight">
                {isPlatform ? "Platform Console" : "SmartPharma ERP"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate tracking-wider uppercase font-medium">Cloud & Web POS</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* New Sale Button */}
      {!isPlatform && (
        <div className={cn("px-3 pt-3 pb-2", collapsed && "px-2")}>
          <button
            onClick={handleNewSale}
            className={cn(
              "flex items-center w-full rounded-lg transition-all duration-150 text-sm font-medium relative cursor-pointer",
              "bg-accent text-accent-foreground hover:bg-accent-hover shadow-xs",
              collapsed ? "justify-center h-9" : "gap-2.5 px-3 h-9"
            )}
            title="New Sale (Ctrl+N)"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="truncate">
                  New Sale
                </motion.span>
              )}
            </AnimatePresence>
            {posWindowCount > 0 && (
              <span
                className={cn(
                  "absolute flex items-center justify-center rounded-full bg-background text-[10px] font-bold text-text-primary border border-border",
                  collapsed ? "-top-1 -right-1 h-5 min-w-5 px-1" : "right-3 h-5 min-w-5 px-1"
                )}
              >
                {posWindowCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto space-y-0.5 px-3 py-1 scrollbar-thin" data-sidebar>
        {navItems.map((item, idx) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
          const Icon = item.icon;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(idx * 0.01, 0.15), duration: 0.15 }}
            >
              <button
                onClick={() => router.push(item.href)}
                className={cn(
                  "group relative flex items-center w-full rounded-lg transition-all duration-150 cursor-pointer",
                  collapsed ? "justify-center h-9" : "gap-3 px-3 pl-3.5 h-9",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
                )}
                <Icon className={cn(
                  "shrink-0 relative",
                  collapsed ? "h-4 w-4" : "h-4 w-4",
                  isActive ? "text-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
                )} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-[13px] relative truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {item.href === "/ai/approvals" && pendingApprovals > 0 && (
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold h-5 min-w-5 px-1.5",
                      collapsed ? "absolute top-0.5 right-0.5" : "ml-auto"
                    )}
                  >
                    {pendingApprovals}
                  </span>
                )}
              </button>
            </motion.div>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-sidebar-border px-3 pt-3 pb-3 space-y-1">
        <div className={cn(
          "flex items-center rounded-lg px-2.5 py-1.5 hover:bg-sidebar-accent/50 transition-colors cursor-pointer",
          collapsed && "justify-center px-0"
        )}>
          <div suppressHydrationWarning className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-[11px]">
            {user?.username?.slice(0, 2).toUpperCase() || "AD"}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 overflow-hidden flex-1 ml-2.5"
              >
                <p suppressHydrationWarning className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">{user?.username || "Admin"}</p>
                <p suppressHydrationWarning className="text-[10px] text-sidebar-foreground/50 truncate tracking-wider uppercase leading-tight mt-0.5">
                  {isPlatform ? "Platform Admin" : (user?.branchName || JOB_ROLE_LABELS[user?.jobRole || ""] || user?.role || "Main Branch")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => router.push("/change-password")}
          className={cn(
            "flex items-center rounded-lg transition-all duration-150 text-sidebar-foreground/50 hover:text-sidebar-foreground cursor-pointer",
            collapsed ? "justify-center h-8" : "gap-2.5 px-2.5 h-8 w-full text-xs"
          )}
          title="Change Password"
        >
          <KeyRound className="h-3.5 w-3.5 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="truncate">
                Change password
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          onClick={logout}
          className={cn(
            "flex items-center rounded-lg transition-all duration-150 text-sidebar-foreground/50 hover:text-danger cursor-pointer",
            collapsed ? "justify-center h-8" : "gap-2.5 px-2.5 h-8 w-full text-xs"
          )}
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="truncate">
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Collapse/Expand Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-14 h-6 w-6 rounded-full border border-border bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-all duration-200 z-30 shadow-xs cursor-pointer",
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
