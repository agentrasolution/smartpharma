"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Building2, LogOut } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="min-h-screen bg-background text-text-primary p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center text-background font-bold text-sm">
              Rx
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">SmartPharma Portal</h1>
              <p className="text-xs text-text-secondary">Welcome, {user.name || user.username}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-danger px-3 py-1.5 rounded-lg border border-border hover:border-danger/30 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-border bg-surface space-y-3">
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 className="font-semibold text-base">Pharmacy Setup & Onboarding</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Configure your pharmacy profile, primary branch, tax number, and regulatory compliance keys.
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="inline-flex items-center gap-1.5 text-xs text-accent font-medium hover:underline pt-2 cursor-pointer"
            >
              Review onboarding wizard <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-surface space-y-3">
            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center text-success">
              <span className="text-xs font-bold">POS</span>
            </div>
            <h2 className="font-semibold text-base">Counter POS Terminal</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              For high-speed dispensing, barcode printing, and thermal receipts, use the SmartPharma Desktop application.
            </p>
            <div className="pt-2 text-xs text-text-secondary">
              Logged in as <span className="font-medium text-text-primary">{user.role}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
