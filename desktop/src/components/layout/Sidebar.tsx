import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Tags, Users, CreditCard,
  Factory, Building2, Undo2, Wallet, BarChart3, Receipt, Barcode, Settings,
  LogOut, PanelLeftClose, BrainCircuit, ListChecks, MessageSquare, ShieldCheck, Activity,
  UserCog, KeyRound, Store, Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { JOB_ROLE_LABELS } from "@/types";
import { toast } from "sonner";
import { api } from "@/lib/api";


const tenantNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS / Sales", icon: ShoppingCart },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/returns", label: "Returns", icon: Undo2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/arrears", label: "Arrears", icon: CreditCard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock", label: "Stock", icon: Boxes },
   { href: "/barcodes", label: "Barcodes", icon: Barcode },
  { href: "/distributors", label: "Distributors", icon: Factory },
  { href: "/companies", label: "Companies", icon: Building2 },
 
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/ai", label: "AI Inventory", icon: BrainCircuit },
  { href: "/ai/recommendations", label: "AI Recommendations", icon: ListChecks },
  { href: "/ai/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/ai/approvals", label: "AI Approvals", icon: ShieldCheck },
  { href: "/ai/activity", label: "AI Activity", icon: Activity },
  { href: "/billing", label: "Subscription & Billing", icon: CreditCard },
  { href: "/users", label: "Users", icon: UserCog },
  { href: "/roles", label: "Roles", icon: KeyRound },
  { href: "/branches", label: "Branches", icon: Store },
  { href: "/settings/ai", label: "LLM Providers", icon: BrainCircuit },
  { href: "/settings", label: "Settings", icon: Settings },
];

const platformNavItems = [
  { href: "/platform", label: "Registered Pharmacies", icon: Globe },
  { href: "/platform", label: "Subscriptions", icon: CreditCard },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const pathname = location.pathname;
  const [collapsed, setCollapsed] = useState(false);
  const [posWindowCount, setPosWindowCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const isPlatform = user?.role === "platform";
  const navItems = isPlatform ? platformNavItems : tenantNavItems;

  const fetchWindowCount = useCallback(async () => {
    try {
      const count = await window.getPosWindowCount();
      setPosWindowCount(count);
    } catch {
      // Not in Electron or not available
    }
  }, []);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const orders = await api.purchaseOrders.list({ status: "PENDING_APPROVAL" });
      setPendingApprovals(orders?.length ?? 0);
    } catch {
      // Not authenticated or request unavailable
    }
  }, []);

  useEffect(() => {
    fetchWindowCount();
    const interval = setInterval(fetchWindowCount, 2000);
    return () => clearInterval(interval);
  }, [fetchWindowCount]);

  useEffect(() => {
    if (isPlatform) return;
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 15000);
    return () => clearInterval(interval);
  }, [fetchPendingApprovals, isPlatform]);

  const handleNewSale = async () => {
    try {
      const result = await window.openPosWindow();
      if (!result.success) {
        toast.error(result.error || "Could not open new sale window");
      }
    } catch {
      navigate("/pos");
    }
  };

  return (
    <aside
      className={cn(
        "h-full bg-sidebar-background flex flex-col shrink-0 transition-all duration-300 ease-out relative select-none",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <div className={cn(
        "flex items-center h-14 relative",
        collapsed ? "justify-center" : "px-4 gap-3"
      )}>
        <div className="flex items-center justify-center rounded-lg h-9 w-9 bg-sidebar-primary/10 shrink-0 overflow-hidden">
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="min-w-0 overflow-hidden"
            >
              <p className="text-sm font-display font-semibold text-sidebar-foreground truncate tracking-tight">
                {isPlatform ? "Platform Console" : "SmartPharma ERP System"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate tracking-widest uppercase">Management</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isPlatform && (
        <div className={cn("px-3 pb-3", collapsed && "px-2")}>
          <button
            onClick={handleNewSale}
            className={cn(
              "flex items-center w-full rounded-lg transition-all duration-150 text-sm font-medium relative",
              "bg-accent text-accent-foreground hover:bg-accent-hover shadow-xs",
              collapsed ? "justify-center h-9" : "gap-2.5 px-3 h-9"
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  New Sale
                </motion.span>
              )}
            </AnimatePresence>
            {posWindowCount > 0 && (
              <span
                className={cn(
                  "absolute flex items-center justify-center rounded-full bg-background text-[10px] font-bold text-text-primary border border-border",
                  collapsed
                    ? "-top-1 -right-1 h-5 min-w-5 px-1"
                    : "right-3 h-5 min-w-5 px-1"
                )}
              >
                {posWindowCount}
              </span>
            )}
          </button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto space-y-1 px-3" data-sidebar>
        {navItems.map((item, idx) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.015, duration: 0.2 }}
            >
              <button
                onClick={() => navigate(item.href)}
                className={cn(
                  "group relative flex items-center w-full rounded-lg transition-all duration-150",
                  collapsed ? "justify-center h-9" : "gap-3 px-3 pl-4 h-9",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-sidebar-primary" />
                )}
                <Icon className={cn(
                  "shrink-0 relative",
                  collapsed ? "h-4 w-4" : "h-4 w-4",
                  isActive ? "text-sidebar-primary" : ""
                )} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-[13px] font-medium relative truncate"
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

      <div className="border-t border-sidebar-border px-3 pt-3 pb-4 space-y-1.5">
        <div className={cn(
          "flex items-center rounded-lg px-3 py-2 hover:bg-sidebar-accent/50 transition-colors cursor-pointer",
          collapsed && "justify-center px-0"
        )}>
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-sidebar-primary">
              {user?.username?.slice(0, 2).toUpperCase() || "AD"}
            </span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 overflow-hidden flex-1 ml-2.5"
              >
                <p className="text-xs font-medium text-sidebar-foreground/80 truncate leading-tight">{user?.username || "Admin"}</p>
                <p className="text-[10px] text-sidebar-foreground/40 truncate tracking-wider uppercase leading-tight">
                  {isPlatform ? "Platform Admin" : (user?.branchName || JOB_ROLE_LABELS[user?.jobRole || ""] || "Main Branch")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => navigate("/change-password")}
          className={cn(
            "flex items-center rounded-lg transition-all duration-150 text-sidebar-foreground/40 hover:text-sidebar-foreground",
            collapsed ? "justify-center h-9" : "gap-3 px-3 h-9 w-full text-xs"
          )}
        >
          <KeyRound className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Change password
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          onClick={logout}
          className={cn(
            "flex items-center rounded-lg transition-all duration-150 text-sidebar-foreground/40 hover:text-danger",
            collapsed ? "justify-center h-9" : "gap-3 px-3 h-9 w-full text-xs"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-14 h-6 w-6 rounded-full border border-border bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-all duration-200 z-20 shadow-xs",
          "hover:scale-105 active:scale-95",
          collapsed && "rotate-180"
        )}
      >
        <PanelLeftClose className="h-3 w-3" />
      </button>
    </aside>
  );
}
