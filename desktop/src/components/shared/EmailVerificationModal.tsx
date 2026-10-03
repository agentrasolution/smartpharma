import { useState, useEffect } from "react";
import { Mail, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface EmailVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
}

export default function EmailVerificationModal({
  open,
  onOpenChange,
  onVerified,
}: EmailVerificationModalProps) {
  const { user, refreshUser } = useAuth();
  const currentEmail = user?.pharmacyProfile?.email || user?.email || "";

  const [email, setEmail] = useState(currentEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEmail(user?.pharmacyProfile?.email || user?.email || "");
      setError("");
      setOtp("");
    }
  }, [open, user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSendCode() {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    setError("");
    setSending(true);
    try {
      const res = await api.auth.sendVerificationEmail(email.trim());
      setCodeSent(true);
      setCooldown(60);
      setIsEditingEmail(false);
      toast.success(res.message || "Verification code sent to your email!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send code";
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 4) {
      setError("Please enter the 6-digit code");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      await api.auth.verifyEmail(otp.trim());
      toast.success("Email verified successfully! Grace period lifted.");
      await refreshUser();
      onVerified?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  }

  const daysRemaining = user?.pharmacyProfile?.gracePeriod?.daysRemaining ?? 7;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-2">
          <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-1">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-bold">Verify Pharmacy Email</DialogTitle>
          <DialogDescription className="text-xs text-text-secondary">
            SmartPharma delivers critical compliance updates, daily Z-reports, and password recovery via{" "}
            <span className="font-semibold text-text-primary">resend.com</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Grace Period Notification Card */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>7-Day Grace Period Active</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-600/90 dark:text-amber-400/90 pl-5.5">
            You have <strong className="font-bold">{daysRemaining} days remaining</strong> to verify.
            During this period, all POS, Inventory, and Dispensing operations remain fully unlocked.
          </p>
        </div>

        <div className="space-y-4 pt-2">
          {/* Target Email Row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] uppercase tracking-wider text-text-secondary">
                Registered Email
              </Label>
              {!codeSent && (
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(!isEditingEmail)}
                  className="text-[11px] text-accent hover:underline font-medium"
                >
                  {isEditingEmail ? "Cancel" : "Change Email"}
                </button>
              )}
            </div>

            {isEditingEmail ? (
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pharmacy@example.com"
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingEmail(false)}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="h-10 px-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs text-text-primary">
                <span className="flex items-center gap-2 truncate">
                  <Mail className="h-3.5 w-3.5 text-text-secondary" />
                  <span className="font-mono">{email || "No email registered"}</span>
                </span>
                {user?.pharmacyProfile?.isEmailVerified && (
                  <span className="flex items-center gap-1 text-emerald-600 text-[11px] font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Send / Resend Code Section */}
          {!codeSent ? (
            <Button
              type="button"
              className="w-full h-10 gap-2 text-xs font-semibold"
              disabled={sending || !email}
              onClick={handleSendCode}
            >
              {sending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Sending 6-Digit Code...
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5" />
                  Send Verification Code via Resend
                </>
              )}
            </Button>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="otp-input" className="text-[11px] uppercase tracking-wider text-text-secondary">
                    Enter 6-Digit OTP Code
                  </Label>
                  <button
                    type="button"
                    disabled={cooldown > 0 || sending}
                    onClick={handleSendCode}
                    className="text-[11px] text-accent hover:underline disabled:opacity-50 disabled:no-underline font-medium flex items-center gap-1"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                  </button>
                </div>

                <Input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="h-12 text-center text-xl font-mono tracking-[0.5em] font-bold"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-2 text-center">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={verifying || otp.length < 4}
                className="w-full h-10 text-xs font-semibold gap-2"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Unlock Account <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
