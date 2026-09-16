import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Building2 } from "lucide-react";
import type { Pharmacy } from "@/types";

function formatDate(input: string | null | undefined, fallback = "—") {
  if (!input) return fallback;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
  if (status === "trial") return <Badge className="bg-accent/10 text-accent border-accent/20">Trial</Badge>;
  if (status === "past_due") return <Badge className="bg-warning/10 text-warning border-warning/20">Past Due</Badge>;
  if (status === "expired") return <Badge className="bg-danger/10 text-danger border-danger/20">Expired</Badge>;
  if (status === "cancelled") return <Badge variant="neutral">Cancelled</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function Billing() {
  const { user, subscriptionBlocked, clearSubscriptionBlocked, refreshUser } = useAuth();
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [extending, setExtending] = useState(false);

  const blocked = subscriptionBlocked;

  async function load() {
    try {
      const ph = await api.pharmacy.get();
      setPharmacy(ph);
      if (ph.subscription) {
        const isHealthy = ph.subscription.status === "active" || ph.subscription.status === "trial";
        if (isHealthy && blocked) clearSubscriptionBlocked();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setError("Your subscription is inactive. Renew your plan to continue using SmartPharma.");
      } else {
        setError(e instanceof Error ? e.message : "Could not load billing info");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  async function handleRenew() {
    if (!pharmacy?.subscription || extending) return;
    setExtending(true);
    setError("");
    try {
      // Requests a manual renewal — the platform admin will process it.
      await api.auth.me();
      await load();
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Renewal request failed");
    } finally {
      setExtending(false);
    }
  }

  const sub = pharmacy?.subscription;
  const isHealthy = sub && (sub.status === "active" || sub.status === "trial");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="max-w-3xl mx-auto"
    >
      {blocked && (
        <div className="mb-5 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
          <div className="text-sm text-danger">
            <p className="font-medium">Subscription inactive</p>
            <p className="text-xs opacity-80 mt-0.5">
              Your pharmacy subscription has lapsed. Data access is paused until your plan is renewed by the platform administrator.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-accent" />
                Subscription & Billing
              </CardTitle>
              <CardDescription className="mt-1">
                Manage your pharmacy plan and billing status.
              </CardDescription>
            </div>
            {pharmacy?.name && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary">
                <Building2 className="h-3.5 w-3.5" />
                {pharmacy.name}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="h-6 w-1/3 bg-surface-2 animate-pulse rounded" />
              <div className="h-4 w-2/3 bg-surface-2 animate-pulse rounded" />
              <div className="h-4 w-1/2 bg-surface-2 animate-pulse rounded" />
            </div>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : sub ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs text-text-secondary">Status</p>
                <StatusBadge status={sub.status} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-text-secondary">Plan</p>
                <p className="text-sm font-medium capitalize">{sub.plan}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-text-secondary">Monthly Price</p>
                <p className="text-sm font-medium">
                  {sub.price > 0 ? `Rs. ${sub.price.toLocaleString()}` : "Free"}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-text-secondary">Renews On</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-text-secondary" />
                  {formatDate(sub.renewsAt)}
                </p>
              </div>
              <div className="col-span-full">
                <div className="flex items-center gap-2 rounded-lg bg-surface-2/60 border border-border px-3 py-2.5">
                  {isHealthy ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  )}
                  <p className="text-xs text-text-secondary">
                    {isHealthy
                      ? "Your subscription is active. No action needed."
                      : "Your subscription needs attention. Contact the platform administrator to renew your plan."}
                  </p>
                </div>
                {!isHealthy && (
                  <Button className="mt-3 w-full" onClick={handleRenew} disabled={extending}>
                    {extending ? "Checking status..." : "Refresh billing status"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No subscription found for this pharmacy.</p>
          )}

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-text-secondary leading-relaxed">
              Billing is managed by the SmartPharma platform administrator. For renewals, plan changes or
              questions, please contact the administrator of your pharmacy account{" "}
              {user?.pharmacyName ? `(${user.pharmacyName})` : ""}.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}