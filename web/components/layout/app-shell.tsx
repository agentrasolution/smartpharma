"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import OfflineBanner from "@/components/shared/OfflineBanner";
import EmailGracePeriodBanner from "@/components/shared/EmailGracePeriodBanner";
import PharmacySetupModal from "@/components/shared/PharmacySetupModal";
import PrintPreviewDialog from "@/components/shared/PrintPreviewDialog";
import { getLastReceipt } from "@/lib/receiptStore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PrinterConfig } from "@/types";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, logout, subscriptionBlocked, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintData, setReprintData] = useState<unknown>(null);

  const isPosWindow = searchParams.get("pos") === "1";
  const isAuthRoute = pathname === "/login" || pathname === "/onboarding" || pathname.startsWith("/login") || pathname.startsWith("/onboarding") || pathname.startsWith("/(auth)");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !isAuthRoute) {
      router.push("/login");
    }
  }, [mounted, isAuthenticated, isAuthRoute, router]);

  useEffect(() => {
    if (subscriptionBlocked && isAuthenticated && pathname !== "/billing") {
      router.push("/billing");
    }
  }, [subscriptionBlocked, isAuthenticated, pathname, router]);

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

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (!isAuthenticated) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        router.push("/returns");
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/pos");
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
      if (typing) return;

      if (e.altKey && !e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "p": router.push("/products"); return;
          case "s": router.push("/stock"); return;
          case "c": router.push("/customers"); return;
          case "r": router.push("/returns"); return;
          case "a": router.push("/arrears"); return;
          case "d": router.push("/distributors"); return;
          case "e": router.push("/expenses"); return;
          case "h": router.push("/reports"); return;
          case "b": router.push("/pos"); return;
          case "l": { e.preventDefault(); logout(); return; }
        }
        return;
      }
      if (e.altKey || e.ctrlKey) return;

      switch (e.key) {
        case "F1": e.preventDefault(); router.push("/pos"); break;
        case "F2": e.preventDefault(); router.push("/invoices"); break;
        case "F3": e.preventDefault(); router.push("/returns"); break;
        case "F4": e.preventDefault(); router.push("/customers"); break;
        case "F5": e.preventDefault(); router.push("/arrears"); break;
        case "F6": e.preventDefault(); router.push("/products"); break;
        case "F7": e.preventDefault(); router.push("/stock"); break;
        case "F8": e.preventDefault(); router.push("/barcodes"); break;
        case "F9": e.preventDefault(); router.push("/expenses"); break;
        case "F10": e.preventDefault(); router.push("/settings"); break;
        case "F11": e.preventDefault(); window.toggleFullscreen?.(); break;
        case "F12": e.preventDefault(); router.push("/dashboard"); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthenticated, router, logout]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (isPosWindow) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="flex flex-1 flex-col overflow-hidden">
          <EmailGracePeriodBanner />
          <OfflineBanner />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
        <PharmacySetupModal />
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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar />
        <EmailGracePeriodBanner />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6 min-w-0">{children}</main>
      </div>
      <PharmacySetupModal />
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
