import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ChevronRight,
  Mail,
  KeyRound,
  Users,
  ShieldAlert,
  CheckCircle2,
  Building2,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import CountrySelect from "@/components/shared/CountrySelect";
import { type Country } from "@/lib/countries";

// ─── Tiny primitives ───────────────────────────────────────────────────────────

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoFocus,
  suffix,
  hint,
  optional,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  suffix?: React.ReactNode;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="block text-[11px] font-medium tracking-wide uppercase text-text-secondary select-none">
          {label}
        </label>
        {optional && <span className="text-[10px] text-text-secondary/60">Optional</span>}
      </div>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className={cn(
            "w-full h-11 rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-secondary/40",
            "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60",
            "transition-all duration-150",
            suffix && "pr-10",
          )}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {suffix}
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] text-text-secondary/70">{hint}</p>}
    </div>
  );
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        "w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2",
        "bg-foreground text-background",
        "hover:opacity-90 active:scale-[0.98]",
        "transition-all duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

// ─── Brand panel (right side) ──────────────────────────────────────────────────

function BrandPanel() {
  return (
    <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between bg-foreground p-10 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-0 right-0 w-72 h-72 bg-accent/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />

      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-background/10 flex items-center justify-center">
            <span className="text-background text-xs font-bold">Rx</span>
          </div>
          <span className="text-background font-semibold text-sm tracking-tight">SmartPharma</span>
        </div>
      </div>

      <div className="relative z-10 space-y-6">
        <div className="space-y-3">
          <p className="text-background/40 text-xs font-medium tracking-widest uppercase">Pharmacy Management</p>
          <h2 className="text-background text-3xl font-bold tracking-tight leading-tight">
            Built for<br />modern pharmacy.
          </h2>
          <p className="text-background/60 text-sm leading-relaxed max-w-[260px]">
            Full inventory control, compliance-ready, automated Resend email notifications, and offline POS shifts.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {["FEFO Batch & Expiry Tracking", "Automated Resend Email Delivery", "Multi-Currency & Regional Tax", "Role-Based Staff Access"].map((f) => (
            <div key={f} className="flex items-center gap-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="text-background/70 text-xs">{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-background/30 text-[11px]">© {new Date().getFullYear()} SmartPharma</p>
      </div>
    </div>
  );
}

// ─── Login & Recovery view ─────────────────────────────────────────────────────

function LoginView({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState(false);

  // Recovery Sub-Modes: "otp" | "staff" | "phrase"
  const [recoveryMode, setRecoveryMode] = useState<"otp" | "staff" | "phrase">("otp");

  // OTP Recovery State
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpNewPw, setOtpNewPw] = useState("");
  const [otpConfirmPw, setOtpConfirmPw] = useState("");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");

  // Recovery Key State
  const [recUsername, setRecUsername] = useState("");
  const [recKey, setRecKey] = useState("");
  const [recNewPw, setRecNewPw] = useState("");
  const [recConfirm, setRecConfirm] = useState("");
  const [recError, setRecError] = useState("");
  const [recLoading, setRecLoading] = useState(false);
  const [recDone, setRecDone] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    const err = await login(username.trim(), password);
    if (err) setError(err);
    setLoading(false);
  }

  // OTP: Step 1 - Send OTP via Resend
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpIdentifier.trim()) {
      setOtpError("Username or administrator email is required");
      return;
    }
    setOtpError("");
    setOtpLoading(true);
    try {
      const res = await api.auth.forgotPassword(otpIdentifier.trim());
      setMaskedEmail(res.maskedEmail);
      setOtpStep("verify");
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to send reset code");
    } finally {
      setOtpLoading(false);
    }
  }

  // OTP: Step 2 - Verify OTP and set new password
  async function handleResetWithOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError("");
    if (!otpCode.trim() || !otpNewPw || !otpConfirmPw) {
      setOtpError("All fields are required");
      return;
    }
    if (otpNewPw !== otpConfirmPw) {
      setOtpError("Passwords do not match");
      return;
    }
    if (otpNewPw.length < 8) {
      setOtpError("Password must be at least 8 characters");
      return;
    }

    setOtpLoading(true);
    try {
      await api.auth.resetPasswordOtp(otpIdentifier.trim(), otpCode.trim(), otpNewPw);
      setRecDone(true);
      setTimeout(() => {
        setRecovery(false);
        setRecDone(false);
        setOtpStep("request");
        setOtpIdentifier("");
        setOtpCode("");
        setOtpNewPw("");
        setOtpConfirmPw("");
      }, 2500);
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setOtpLoading(false);
    }
  }

  // 12-Word Recovery Phrase
  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setRecError("");
    if (!recUsername.trim() || !recKey.trim() || !recNewPw || !recConfirm) {
      setRecError("All fields are required");
      return;
    }
    if (recNewPw !== recConfirm) {
      setRecError("Passwords do not match");
      return;
    }
    if (recNewPw.length < 8) {
      setRecError("Password must be at least 8 characters");
      return;
    }
    setRecLoading(true);
    try {
      const res = await api.auth.recoverPassword(recKey.trim(), recNewPw, recUsername.trim());
      if (res.error) {
        setRecError(res.error);
      } else {
        setRecDone(true);
        setTimeout(() => setRecovery(false), 2500);
      }
    } catch {
      setRecError("Recovery failed. Check your key and try again.");
    } finally {
      setRecLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[380px] mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <div className="h-6 w-6 rounded-md bg-foreground flex items-center justify-center">
            <span className="text-background text-[10px] font-bold">Rx</span>
          </div>
          <span className="text-text-primary font-semibold text-sm">SmartPharma</span>
        </div>
        <AnimatePresence mode="wait">
          {!recovery ? (
            <motion.div key="login-header" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">Welcome back</h1>
              <p className="text-sm text-text-secondary mt-1">Sign in to your pharmacy account</p>
            </motion.div>
          ) : (
            <motion.div key="recovery-header" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">Account Recovery</h1>
              <p className="text-sm text-text-secondary mt-1">Reset your password or learn how to recover access</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {!recovery ? (
          <motion.form
            key="login-form"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleLogin}
            className="space-y-4"
          >
            <Field id="username" label="Username" value={username} onChange={setUsername} placeholder="Enter your username" autoFocus />
            <Field
              id="password"
              label="Password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              suffix={
                <button type="button" onClick={() => setShowPw(!showPw)} className="text-text-secondary hover:text-text-primary transition-colors">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5 text-center">
                {error}
              </motion.p>
            )}

            <SubmitButton loading={loading} label="Sign in" loadingLabel="Signing in..." />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => { setRecovery(true); setError(""); }}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={onSwitch}
                className="text-xs text-accent hover:text-accent-hover font-medium transition-colors flex items-center gap-1"
              >
                Create pharmacy <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="recovery-container"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {recDone ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <p className="text-sm font-semibold text-text-primary">Password reset successfully</p>
                <p className="text-xs text-text-secondary">You can now sign in with your new password.</p>
              </motion.div>
            ) : (
              <>
                {/* Recovery Mode Tabs */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => { setRecoveryMode("otp"); setOtpError(""); }}
                    className={cn(
                      "py-1.5 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-1.5",
                      recoveryMode === "otp"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <Mail className="h-3 w-3" />
                    <span>Email OTP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRecoveryMode("staff"); setOtpError(""); }}
                    className={cn(
                      "py-1.5 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-1.5",
                      recoveryMode === "staff"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <Users className="h-3 w-3" />
                    <span>Staff Help</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRecoveryMode("phrase"); setRecError(""); }}
                    className={cn(
                      "py-1.5 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-1.5",
                      recoveryMode === "phrase"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <KeyRound className="h-3 w-3" />
                    <span>12 Words</span>
                  </button>
                </div>

                {/* Sub-mode 1: Email OTP (Resend) */}
                {recoveryMode === "otp" && (
                  <div>
                    {otpStep === "request" ? (
                      <form onSubmit={handleSendOtp} className="space-y-4 pt-1">
                        <Field
                          id="otp-ident"
                          label="Username or Administrator Email"
                          value={otpIdentifier}
                          onChange={setOtpIdentifier}
                          placeholder="e.g. admin or pharmacy@domain.com"
                          autoFocus
                          hint="We will send a 6-digit OTP code to your registered pharmacy email via Resend."
                        />

                        {otpError && (
                          <p className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg p-2.5 text-center">
                            {otpError}
                          </p>
                        )}

                        <SubmitButton loading={otpLoading} label="Send Code via Resend" loadingLabel="Sending code..." />
                      </form>
                    ) : (
                      <form onSubmit={handleResetWithOtp} className="space-y-3 pt-1">
                        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 text-xs text-accent space-y-1">
                          <p className="font-semibold">Reset code sent!</p>
                          <p className="text-[11px] text-text-secondary">
                            A 6-digit code has been delivered to <span className="font-mono text-text-primary">{maskedEmail}</span>.
                          </p>
                        </div>

                        <Field
                          id="otp-code"
                          label="6-Digit OTP Code"
                          value={otpCode}
                          onChange={(v) => setOtpCode(v.replace(/\D/g, ""))}
                          placeholder="123456"
                          autoFocus
                        />

                        <Field
                          id="otp-new-pw"
                          label="New Password"
                          type="password"
                          value={otpNewPw}
                          onChange={setOtpNewPw}
                          placeholder="Min 8 characters"
                        />

                        <Field
                          id="otp-confirm-pw"
                          label="Confirm Password"
                          type="password"
                          value={otpConfirmPw}
                          onChange={setOtpConfirmPw}
                          placeholder="Repeat new password"
                        />

                        {otpError && (
                          <p className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg p-2.5 text-center">
                            {otpError}
                          </p>
                        )}

                        <SubmitButton loading={otpLoading} label="Update Password & Sign In" loadingLabel="Resetting..." />

                        <button
                          type="button"
                          onClick={() => setOtpStep("request")}
                          className="w-full text-xs text-accent hover:underline text-center pt-1"
                        >
                          Didn't get the code? Change email / Resend
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Sub-mode 2: Staff Help Card */}
                {recoveryMode === "staff" && (
                  <div className="space-y-4 pt-1">
                    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-text-primary font-semibold text-xs">
                        <Users className="h-4 w-4 text-accent" />
                        <span>Staff Password Reset (Cashiers & Dispensers)</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        In enterprise pharmacy operations, staff members (cashiers, technicians, inventory handlers) do not possess individual billing email addresses.
                      </p>
                      <div className="rounded-lg bg-surface-2/60 p-3 space-y-1.5 border border-border/50 text-[11px] text-text-secondary">
                        <strong className="text-text-primary block font-medium">How to get your password reset:</strong>
                        <ol className="list-decimal list-inside space-y-1 pl-1">
                          <li>Contact your <strong>Pharmacy Administrator</strong> or <strong>Store Manager</strong>.</li>
                          <li>They can open <strong>Settings &gt; Users &amp; Roles</strong>.</li>
                          <li>Clicking <strong>&quot;Reset Password&quot;</strong> on your profile generates a temporary password.</li>
                          <li>Sign in with that temporary password—you will be prompted to set your new private password immediately.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-mode 3: 12-Word Recovery Key */}
                {recoveryMode === "phrase" && (
                  <form onSubmit={handleRecovery} className="space-y-4 pt-1">
                    <Field id="rec-username" label="Username" value={recUsername} onChange={setRecUsername} placeholder="Your username" autoFocus />
                    <Field id="rec-key" label="Recovery key" value={recKey} onChange={setRecKey} placeholder="Paste your 12-word recovery phrase" />
                    <Field id="rec-new-pw" label="New password" type="password" value={recNewPw} onChange={setRecNewPw} placeholder="Min 8 characters" />
                    <Field id="rec-confirm" label="Confirm password" type="password" value={recConfirm} onChange={setRecConfirm} placeholder="Repeat new password" />

                    {recError && (
                      <p className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg px-3 py-2 text-center">
                        {recError}
                      </p>
                    )}

                    <SubmitButton loading={recLoading} label="Reset password" loadingLabel="Resetting..." />
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => { setRecovery(false); setRecError(""); setOtpError(""); setOtpStep("request"); }}
                  className="w-full text-xs text-text-secondary hover:text-text-primary transition-colors text-center pt-2"
                >
                  ← Back to sign in
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Register view ─────────────────────────────────────────────────────────────

function RegisterView({ onSwitch, onRegistered }: { onSwitch: () => void; onRegistered: () => void }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("SA");
  const [countryName, setCountryName] = useState("Saudi Arabia");
  const [currency, setCurrency] = useState("SAR");
  const [phone, setPhone] = useState("+966 ");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleCountrySelect(c: Country) {
    setCountryCode(c.code);
    setCountryName(c.name);
    setCurrency(c.currency);
    setPhone(c.dialCode + " ");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !username.trim() || !password) return;
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setLoading(true);
    const tempPharmacyName = `${name.trim()} Pharmacy ${Date.now().toString().slice(-4)}`;
    const err = await register({
      pharmacyName: tempPharmacyName,
      branchName: "Main Branch",
      name: name.trim(),
      username: username.trim(),
      password,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      countryCode,
      countryName,
      currency,
    });
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      localStorage.setItem("smartpharma_currency", currency);
      onRegistered();
    }
  }

  return (
    <div className="w-full max-w-[380px] mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <div className="h-6 w-6 rounded-md bg-foreground flex items-center justify-center">
            <span className="text-background text-[10px] font-bold">Rx</span>
          </div>
          <span className="text-text-primary font-semibold text-sm">SmartPharma</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Create your account</h1>
        <p className="text-sm text-text-secondary mt-1">Start your 30-day trial with full ERP access</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <Field id="reg-name" label="Your Full Name" value={name} onChange={setName} placeholder="e.g. Dr. Ahmed Al-Rashid" autoFocus />
        <Field id="reg-username" label="Username" value={username} onChange={setUsername} placeholder="Unique username to sign in" />
        
        {/* Email field for Resend verification & 7-day grace period */}
        <Field
          id="reg-email"
          label="Administrator Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="admin@pharmacy.com"
          hint="Used for password recovery and 7-day email verification via Resend."
        />

        {/* Country combobox */}
        <CountrySelect
          value={countryCode}
          onChange={handleCountrySelect}
          label="Country & Regional Currency"
        />

        <Field
          id="reg-password"
          label="Password"
          type={showPw ? "text" : "password"}
          value={password}
          onChange={setPassword}
          placeholder="Min 8 characters"
          suffix={
            <button type="button" onClick={() => setShowPw(!showPw)} className="text-text-secondary hover:text-text-primary transition-colors">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <Field id="reg-confirm" label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat your password" />

        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg px-3 py-2 text-center">
            {error}
          </motion.p>
        )}

        <SubmitButton loading={loading} label="Create Account & Continue" loadingLabel="Setting up..." />

        <button
          type="button"
          onClick={onSwitch}
          className="w-full text-xs text-text-secondary hover:text-text-primary transition-colors text-center pt-1 flex items-center justify-center gap-1"
        >
          Already have an account?{" "}
          <span className="text-accent hover:text-accent-hover font-medium">Sign in</span>
        </button>
      </form>
    </div>
  );
}

// ─── Root Login page ───────────────────────────────────────────────────────────

export default function Login({ onRegistered }: { onRegistered?: () => void }) {
  const [view, setView] = useState<"login" | "register">("login");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left: Form area */}
      <div className="flex flex-1 items-center justify-center p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === "login" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full"
            >
              <LoginView onSwitch={() => setView("register")} />
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full"
            >
              <RegisterView
                onSwitch={() => setView("login")}
                onRegistered={() => onRegistered?.()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Brand panel */}
      <BrandPanel />
    </div>
  );
}
