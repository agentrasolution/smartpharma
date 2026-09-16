import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ServerConnectionProvider } from "@/contexts/ServerConnectionContext";
import PrintPreviewDialog from "@/components/shared/PrintPreviewDialog";
import { getLastReceipt } from "@/lib/receiptStore";
import type { PrinterConfig } from "@/types";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import OfflineBanner from "@/components/shared/OfflineBanner";
import Login from "@/pages/Login";
import Billing from "@/pages/Billing";
import PlatformAdmin from "@/pages/PlatformAdmin";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Arrears from "@/pages/Arrears";
import Stock from "@/pages/Stock";
import Distributors from "@/pages/Distributors";
import Companies from "@/pages/Companies";
import Returns from "@/pages/Returns";
import Categories from "@/pages/Categories";
import Barcodes from "@/pages/Barcodes";
import Expenses from "@/pages/Expenses";
import Reports from "@/pages/Reports";
import Invoices from "@/pages/Invoices";
import Settings from "@/pages/Settings";
import Users from "@/pages/Users";
import Roles from "@/pages/Roles";
import Branches from "@/pages/Branches";
import ChangePassword from "@/pages/ChangePassword";
import AIProvidersIndex from "@/pages/settings/AIProvidersIndex";
import AIProviderSetupPage from "@/pages/settings/AIProviderSetupPage";
import AIOverview from "@/pages/ai/AIOverview";
import AIRecommendations from "@/pages/ai/AIRecommendations";
import AIChat from "@/pages/ai/AIChat";
import AIApprovals from "@/pages/ai/AIApprovals";
import AIActivity from "@/pages/ai/AIActivity";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: "easeIn" } },
} as const;

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}

function AppShell() {
  const { isAuthenticated, logout, subscriptionBlocked, user } = useAuth();
  const [ready, setReady] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isPosWindow = new URLSearchParams(location.search).has("pos");

  const isPlatform = user?.role === "platform";

  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintData, setReprintData] = useState<unknown>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (subscriptionBlocked && isAuthenticated && !isPlatform && location.pathname !== "/billing") {
      navigate("/billing", { replace: true });
    }
  }, [subscriptionBlocked, isAuthenticated, isPlatform, location.pathname, navigate]);

  const generateReprintHtml = useCallback(async (paperSize: string): Promise<string> => {
    if (!reprintData) return "";
    const result = await window.generateReceiptHTML(reprintData, paperSize);
    return result.success ? result.html : "";
  }, [reprintData]);

  async function handleReprint(config: PrinterConfig) {
    if (!reprintData) return;
    const result = await window.printReceipt(reprintData, config);
    if (!result.success) {
      throw new Error(result.error || "Print failed");
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        navigate("/returns");
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        navigate("/pos");
        return;
      }
      if ((e.ctrlKey && e.key.toLowerCase() === "p") || (e.altKey && e.key.toLowerCase() === "t")) {
        e.preventDefault();
        const data = getLastReceipt();
        if (data) {
          setReprintData(data);
          setReprintOpen(true);
        } else {
          toast.error("No recent receipt to print");
        }
        return;
      }
      if (e.altKey && !e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "p": navigate("/products"); return;
          case "s": navigate("/stock"); return;
          case "c": navigate("/customers"); return;
          case "r": navigate("/returns"); return;
          case "a": navigate("/arrears"); return;
          case "d": navigate("/distributors"); return;
          case "e": navigate("/expenses"); return;
          case "h": navigate("/reports"); return;
          case "b": navigate("/pos"); return;
          case "l": { e.preventDefault(); logout(); return; }
        }
        return;
      }
      if (e.altKey || e.ctrlKey) return;

      switch (e.key) {
        case "F1": e.preventDefault(); navigate("/pos"); break;
        case "F2": e.preventDefault(); navigate("/invoices"); break;
        case "F3": e.preventDefault(); navigate("/returns"); break;
        case "F4": e.preventDefault(); navigate("/customers"); break;
        case "F5": e.preventDefault(); navigate("/arrears"); break;
        case "F6": e.preventDefault(); navigate("/products"); break;
        case "F7": e.preventDefault(); navigate("/stock"); break;
        case "F8": e.preventDefault(); navigate("/barcodes"); break;
        case "F9": e.preventDefault(); navigate("/expenses"); break;
        case "F10": e.preventDefault(); navigate("/settings"); break;
        case "F11": e.preventDefault(); window.toggleFullscreen?.(); break;
        case "F12": e.preventDefault(); navigate("/dashboard"); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthenticated, navigate, logout]);

  if (!ready) return null;

  if (!isAuthenticated) {
    return <Login />;
  }

  const routes = (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to={isPlatform ? "/platform" : "/pos"} replace />} />
        <Route
          path="/platform"
          element={
            isPlatform ? (
              <AnimatedPage><PlatformAdmin /></AnimatedPage>
            ) : (
              <Navigate to="/pos" replace />
            )
          }
        />
        <Route path="/change-password" element={<AnimatedPage><ChangePassword /></AnimatedPage>} />
        {!isPlatform && (
          <>
            <Route path="/dashboard" element={<AnimatedPage><Dashboard /></AnimatedPage>} />
            <Route path="/pos" element={<AnimatedPage><POS /></AnimatedPage>} />
            <Route path="/products" element={<AnimatedPage><Products /></AnimatedPage>} />
            <Route path="/customers" element={<AnimatedPage><Customers /></AnimatedPage>} />
            <Route path="/customers/:id" element={<AnimatedPage><CustomerDetail /></AnimatedPage>} />
            <Route path="/arrears" element={<AnimatedPage><Arrears /></AnimatedPage>} />
            <Route path="/stock" element={<AnimatedPage><Stock /></AnimatedPage>} />
            <Route path="/distributors" element={<AnimatedPage><Distributors /></AnimatedPage>} />
            <Route path="/companies" element={<AnimatedPage><Companies /></AnimatedPage>} />
            <Route path="/barcodes" element={<AnimatedPage><Barcodes /></AnimatedPage>} />
            <Route path="/returns" element={<AnimatedPage><Returns /></AnimatedPage>} />
            <Route path="/expenses" element={<AnimatedPage><Expenses /></AnimatedPage>} />
            <Route path="/reports" element={<AnimatedPage><Reports /></AnimatedPage>} />
            <Route path="/invoices" element={<AnimatedPage><Invoices /></AnimatedPage>} />
            <Route path="/settings" element={<AnimatedPage><Settings /></AnimatedPage>} />
            <Route path="/users" element={<AnimatedPage><Users /></AnimatedPage>} />
            <Route path="/roles" element={<AnimatedPage><Roles /></AnimatedPage>} />
            <Route path="/branches" element={<AnimatedPage><Branches /></AnimatedPage>} />
            <Route path="/settings/ai" element={<AnimatedPage><AIProvidersIndex /></AnimatedPage>} />
            <Route path="/settings/ai/:providerId" element={<AnimatedPage><AIProviderSetupPage /></AnimatedPage>} />
            <Route path="/billing" element={<AnimatedPage><Billing /></AnimatedPage>} />
            <Route path="/ai" element={<AnimatedPage><AIOverview /></AnimatedPage>} />
            <Route path="/ai/recommendations" element={<AnimatedPage><AIRecommendations /></AnimatedPage>} />
            <Route path="/ai/chat" element={<AnimatedPage><AIChat /></AnimatedPage>} />
            <Route path="/ai/approvals" element={<AnimatedPage><AIApprovals /></AnimatedPage>} />
            <Route path="/ai/activity" element={<AnimatedPage><AIActivity /></AnimatedPage>} />
          </>
        )}
        <Route path="*" element={<Navigate to={isPlatform ? "/platform" : "/pos"} replace />} />
      </Routes>
    </AnimatePresence>
  );

  if (isPosWindow) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <OfflineBanner />
          <main className="flex-1 overflow-y-auto p-5 lg:p-6">{routes}</main>
        </div>
        <PrintPreviewDialog
          open={reprintOpen}
          onOpenChange={(v) => {
            setReprintOpen(v);
            if (!v) setReprintData(null);
          }}
          title="Receipt Preview"
          htmlGenerator={generateReprintHtml}
          onPrint={handleReprint}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">{routes}</main>
      </div>
      <PrintPreviewDialog
        open={reprintOpen}
        onOpenChange={(v) => {
          setReprintOpen(v);
          if (!v) setReprintData(null);
        }}
        title="Receipt Preview"
        htmlGenerator={generateReprintHtml}
        onPrint={handleReprint}
      />
    </div>
  );
}

export default function App() {
  return (
    <ServerConnectionProvider>
      <AuthProvider>
        <AppShell />
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </ServerConnectionProvider>
  );
}
