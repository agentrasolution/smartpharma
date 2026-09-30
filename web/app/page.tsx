"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PortalNav } from "@/components/portal-nav";
import {
  ArrowRight,
  Building2,
  Pill,
  ShieldCheck,
  Sparkles,
  Laptop,
  Receipt,
  FileText,
  HeartPulse,
  ArrowLeftRight,
  BarChart3,
} from "lucide-react";

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const mounted = useMounted();

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/login");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 rounded-full border-2 border-foreground/30 border-t-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col antialiased">
      <PortalNav />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Welcome Banner */}
        <div className="p-8 rounded-3xl bg-linear-to-br from-accent/10 via-surface to-surface border border-accent/20 shadow-xs relative overflow-hidden">
          <div className="max-w-2xl space-y-2 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>SmartPharma Cloud Suite</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">
              Welcome back, {user.name || user.username}
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              Managing <span className="font-semibold text-text-primary">{user.pharmacyName || "Pharmacy"}</span> ({user.branchName || "Primary Branch"}). Central catalog, regulatory drug classifications, and compliance integrations.
            </p>
          </div>

          <div className="absolute right-6 -bottom-6 opacity-10 text-accent pointer-events-none hidden sm:block">
            <Pill className="h-44 w-44" />
          </div>
        </div>

        {/* Feature Hub Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Drug Master Catalog */}
          <div className="p-5 rounded-2xl border border-accent/30 bg-surface shadow-xs hover:border-accent hover:shadow-md transition-all space-y-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                <Pill className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-text-primary">Drug Master Data</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-white uppercase">
                    Pillar B
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Trade names, generic-to-brand links, drug registration codes, Rx/controlled flags, and multi-unit pack conversions.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/drug-master")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold shadow-xs hover:bg-accent-hover transition-all cursor-pointer"
            >
              Open Catalog <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Card 2: Purchasing & Direct Invoices */}
          <div className="p-5 rounded-2xl border border-blue-500/30 bg-surface shadow-xs hover:border-blue-500 hover:shadow-md transition-all space-y-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-text-primary">Purchasing & AP</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white uppercase">
                    Pillar D
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Direct supplier delivery invoices, multi-line batch entry, Accounts Payable ledger, and supplier payment statements.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/purchases")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              Supplier Invoices <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Card 3: Dispensing & Prescriptions (Pillar E) */}
          <div className="p-5 rounded-2xl border border-purple-500/30 bg-surface shadow-xs hover:border-purple-500 hover:shadow-md transition-all space-y-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-text-primary">Dispensing & Rx</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500 text-white uppercase">
                    Pillar E
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Pharmacist verification, brand-to-generic substitution engine, partial fills, and controlled drug register.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/prescriptions")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              Dispensing Queue <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Card 4: Patients, Chronic Refills & Credit (Pillar H) */}
          <div className="p-5 rounded-2xl border border-rose-500/30 bg-surface shadow-xs hover:border-rose-500 hover:shadow-md transition-all space-y-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-text-primary">Patients & Refills</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white uppercase">
                    Pillar H
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Patient clinical profiles, informed health consent, automated chronic medication refills, and credit ledger.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/patients")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              Patient Directory <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Card 5: Multi-Branch & Stock Transfers (Pillar G) */}
          <div className="p-5 rounded-2xl border border-blue-500/30 bg-surface shadow-xs hover:border-blue-500 hover:shadow-md transition-all space-y-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-text-primary">Multi-Branch & Transfers</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white uppercase">
                    Pillar G
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Inter-branch transfers with batch travel, central catalog control, branch pricing overrides, and cross-branch stock search.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/transfers")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              Transfers & Network Stock <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Card 6: Costing & Financial Reports (Pillar I) */}
          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-surface shadow-xs hover:border-emerald-500 hover:shadow-md transition-all space-y-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-text-primary">Costing & Reports</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white uppercase">
                    Pillar I
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Real-time COGS, P&L statements, multi-dimensional gross margins, inventory shrinkage, stock valuation, and accountant CSV exports.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/reports")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              Financial Analytics <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Card 7: Onboarding & Setup */}
          <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs hover:border-border-strong hover:shadow-md transition-all space-y-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary group-hover:scale-110 transition-transform">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-text-primary">Branches & Profile</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-surface-2 text-text-secondary border border-border uppercase">
                    Pillar A
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Configure corporate credentials, business registration, tax settings, and branch profiles.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/onboarding")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface-2 hover:bg-border text-text-primary text-xs font-semibold transition-all cursor-pointer"
            >
              Pharmacy Setup <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Card 4: Desktop POS Terminal */}
          <div className="p-5 rounded-2xl border border-border bg-surface shadow-xs hover:border-border-strong hover:shadow-md transition-all space-y-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Laptop className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-text-primary">Desktop POS</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 uppercase">
                    Offline
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Offline-first barcode scanning, thermal printing, and FEFO dispensing counter.
                </p>
              </div>
            </div>

            <div className="pt-2 text-xs text-text-secondary flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Offline-ready sync engine</span>
            </div>
          </div>
        </div>

        {/* Core Pharmacy Enterprise Architecture */}
        <div className="p-6 rounded-2xl border border-border bg-surface-2/60 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <span>Core Pharmacy Enterprise Architecture</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
              <div className="font-semibold text-text-primary">FEFO & Batch Traceability</div>
              <p className="text-[11px] text-text-secondary">Lot numbers, expiry countdown & recall blocking</p>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
              <div className="font-semibold text-text-primary">Dispensing & Rx Verification</div>
              <p className="text-[11px] text-text-secondary">Generic substitution & controlled drug register</p>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
              <div className="font-semibold text-text-primary">Purchasing & Invoices</div>
              <p className="text-[11px] text-text-secondary">Direct supplier invoices & batch receiving costs</p>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
              <div className="font-semibold text-text-primary">POS Shifts & Split Payments</div>
              <p className="text-[11px] text-text-secondary">Cash float, cash drops & third-party receivables</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
