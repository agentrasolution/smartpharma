import { useState } from "react";
import { Mail, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import EmailVerificationModal from "./EmailVerificationModal";
import { cn } from "@/lib/utils";

export default function EmailGracePeriodBanner() {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Only display for logged-in pharmacy administrators whose email is not verified
  if (!user || user.role !== "admin") return null;

  const profile = user.pharmacyProfile;
  if (!profile || profile.isEmailVerified) return null;

  const grace = profile.gracePeriod;
  const isRestricted = grace?.isRestricted ?? false;
  const daysRemaining = grace?.daysRemaining ?? 7;

  if (dismissed && !isRestricted) return null;

  return (
    <>
      <div
        className={cn(
          "w-full px-4 py-2 text-xs flex items-center justify-between gap-3 border-b transition-colors z-40 relative",
          isRestricted
            ? "bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200"
            : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200",
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          {isRestricted ? (
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 animate-pulse" />
          ) : (
            <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}

          <span className="truncate">
            {isRestricted ? (
              <>
                <strong className="font-semibold">Verification Grace Period Expired:</strong> Please verify your pharmacy email immediately via Resend to maintain uninterrupted compliance and exports.
              </>
            ) : (
              <>
                <strong className="font-semibold">Email Verification Grace Period:</strong> You have{" "}
                <span className="font-bold underline decoration-amber-500 decoration-2 underline-offset-2">
                  {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
                </span>{" "}
                to verify <span className="font-mono text-[11px] opacity-90">{profile.email || user.email}</span>.
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={cn(
              "px-3 py-1 rounded-lg font-semibold text-[11px] transition-all duration-150 flex items-center gap-1.5 shadow-sm active:scale-95",
              isRestricted
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-amber-600 text-white hover:bg-amber-700",
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify Now
          </button>

          {!isRestricted && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss banner"
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <EmailVerificationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
