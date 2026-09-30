"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Pill, LayoutDashboard, Building2, LogOut, ShieldCheck, User, Receipt, FileText, HeartPulse, ArrowLeftRight, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortalNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/drug-master", label: "Drug Master Catalog", icon: Pill },
    { href: "/purchases", label: "Purchases & Invoices", icon: Receipt },
    { href: "/prescriptions", label: "Dispensing & Rx", icon: FileText },
    { href: "/patients", label: "Patients & Refills", icon: HeartPulse },
    { href: "/transfers", label: "Multi-Branch & Transfers", icon: ArrowLeftRight },
    { href: "/reports", label: "Costing & Reports", icon: BarChart3 },
    { href: "/onboarding", label: "Pharmacy Profile", icon: Building2 },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/85 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Nav Links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center text-background font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
              Rx
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-text-primary">SmartPharma</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                  <ShieldCheck className="h-2.5 w-2.5" /> Regulatory Compliance
                </span>
              </div>
              <span className="text-[11px] text-text-secondary leading-none">Cloud Management Portal</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                    isActive
                      ? "bg-accent/10 text-accent font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-accent" : "text-text-secondary")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User / Branch & Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-border text-text-secondary">
                <Building2 className="h-3 w-3 text-text-secondary" />
                <span className="font-medium text-text-primary">{user.branchName || "Main Branch"}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/5 border border-accent/15 text-accent">
                <User className="h-3 w-3" />
                <span className="font-medium">{user.name || user.username}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent/15 text-accent font-bold uppercase">
                  {user.role}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            title="Sign out of portal"
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-danger px-3 py-1.5 rounded-lg border border-border hover:border-danger/30 hover:bg-danger/5 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
