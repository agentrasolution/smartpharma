import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Server, Monitor, Sun, Moon, RefreshCw, Database, Wifi, Clock } from "lucide-react";
import { useServerConnection } from "@/contexts/ServerConnectionContext";
import GlobalSearch from "@/components/shared/GlobalSearch";

const pageLabels: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Business overview" },
  "/pos": { title: "Point of Sale", subtitle: "Create and manage sales" },
  "/products": { title: "Products", subtitle: "Inventory management" },
  "/barcodes": { title: "Barcodes", subtitle: "Custom barcode labels" },
  "/stock": { title: "Stock", subtitle: "Purchase management" },
  "/customers": { title: "Customers", subtitle: "Customer records" },
  "/invoices": { title: "Invoices", subtitle: "Sales invoices" },
  "/arrears": { title: "Arrears", subtitle: "Outstanding payments" },
  "/distributors": { title: "Distributors", subtitle: "Supplier management" },
  "/companies": { title: "Companies", subtitle: "Company records" },
  "/returns": { title: "Returns", subtitle: "Return management" },
  "/expenses": { title: "Expenses", subtitle: "Expense tracking" },
  "/reports": { title: "Reports", subtitle: "Business insights" },
  "/settings": { title: "Settings", subtitle: "System configuration" },
};

export default function Topbar() {
  const location = useLocation();
  const [time, setTime] = useState("");
  const [dark, setDark] = useState(false);
  const [showConnectionDropdown, setShowConnectionDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowConnectionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("faraz_theme", next ? "dark" : "light"); } catch {}
  }

  const { isOnline, isInitialCheck, connectionInfo, reconnect } = useServerConnection();
  const page = pageLabels[location.pathname] || { title: "Dashboard", subtitle: "Business overview" };
  const isServer = window.appConfig?.mode === "server";

  const formatLastChecked = (date: Date | null) => {
    if (!date) return "Never";
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <header className="h-14 border-b border-border bg-surface/70 backdrop-blur-lg sticky top-0 z-30">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
          >
            <h1 className="text-sm font-display font-semibold text-text-primary tracking-tight">{page.title}</h1>
            <p className="text-[11px] text-text-secondary leading-none mt-0.5">{page.subtitle}</p>
          </motion.div>

          <GlobalSearch />
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status Badge */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setShowConnectionDropdown(!showConnectionDropdown)}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-muted text-[11px] text-text-secondary font-medium hover:bg-muted/80 transition-all cursor-pointer"
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  isInitialCheck
                    ? "bg-muted-foreground/40"
                    : isOnline
                      ? "bg-success"
                      : "bg-danger"
                }`}
              />
              {isServer ? (
                <Server className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>{isServer ? "Server" : "Client"}</span>
            </button>

            <AnimatePresence>
              {showConnectionDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-72 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-text-primary">Connection Status</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          reconnect();
                        }}
                        className="h-6 w-6 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-muted transition-all"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 space-y-3">
                    {/* Server */}
                    <div className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Server className="h-3.5 w-3.5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider">Server</p>
                        <p className="text-xs font-mono font-medium text-text-primary truncate">{connectionInfo.serverUrl.replace(/^https?:\/\//, "")}</p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                        <Wifi className="h-3.5 w-3.5 text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider">Status</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${connectionInfo.isOnline ? "bg-success" : "bg-danger"}`} />
                          <p className={`text-xs font-medium ${connectionInfo.isOnline ? "text-success" : "text-danger"}`}>
                            {connectionInfo.isOnline ? "Connected" : "Disconnected"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Response */}
                    <div className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Clock className="h-3.5 w-3.5 text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider">Response</p>
                        <p className="text-xs font-mono font-medium text-text-primary">
                          {connectionInfo.responseTime !== null ? `${connectionInfo.responseTime} ms` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Database */}
                    <div className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Database className="h-3.5 w-3.5 text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider">Database</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${connectionInfo.databaseOnline ? "bg-success" : "bg-danger"}`} />
                          <p className={`text-xs font-medium ${connectionInfo.databaseOnline ? "text-success" : "text-danger"}`}>
                            {connectionInfo.databaseOnline ? "Online" : "Offline"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Last Checked */}
                    <div className="pt-2 border-t border-border">
                      <p className="text-[10px] text-text-secondary">
                        Last checked: <span className="font-medium text-text-primary">{formatLastChecked(connectionInfo.lastChecked)}</span>
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <span className="text-xs text-text-secondary tabular-nums font-mono font-medium">{time}</span>

          <button
            onClick={toggleDark}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-muted transition-all"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
