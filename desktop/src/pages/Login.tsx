import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, ArrowRight, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

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
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-medium tracking-wide uppercase text-text-secondary select-none">
        {label}
      </label>
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
            "w-full h-10 rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-secondary/50",
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
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glowing orb */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-accent/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />

      {/* Logo */}
      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-background/10 flex items-center justify-center">
            <span className="text-background text-xs font-bold">Rx</span>
          </div>
          <span className="text-background font-semibold text-sm tracking-tight">SmartPharma</span>
        </div>
      </div>

      {/* Center content */}
      <div className="relative z-10 space-y-6">
        <div className="space-y-3">
          <p className="text-background/40 text-xs font-medium tracking-widest uppercase">Pharmacy Management</p>
          <h2 className="text-background text-3xl font-bold tracking-tight leading-tight">
            Built for<br />modern pharmacy.
          </h2>
          <p className="text-background/60 text-sm leading-relaxed max-w-[260px]">
            Full inventory control, compliance-ready, and designed to run your entire pharmacy from one screen.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-col gap-2">
          {["FEFO Batch Tracking", "Multi-branch support", "Offline-first POS"].map((f) => (
            <div key={f} className="flex items-center gap-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="text-background/70 text-xs">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="relative z-10">
        <p className="text-background/30 text-[11px]">© {new Date().getFullYear()} SmartPharma</p>
      </div>
    </div>
  );
}

// ─── Login view ────────────────────────────────────────────────────────────────

function LoginView({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState(false);

  // Recovery state
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

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setRecError("");
    if (!recUsername.trim() || !recKey.trim() || !recNewPw || !recConfirm) {
      setRecError("All fields are required");
      return;
    }
    if (recNewPw !== recConfirm) { setRecError("Passwords do not match"); return; }
    if (recNewPw.length < 8) { setRecError("Password must be at least 8 characters"); return; }
    setRecLoading(true);
    try {
      const res = await api.auth.recoverPassword(recKey.trim(), recNewPw, recUsername.trim());
      if (res.error) { setRecError(res.error); }
      else { setRecDone(true); setTimeout(() => setRecovery(false), 2500); }
    } catch { setRecError("Recovery failed. Check your key and try again."); }
    finally { setRecLoading(false); }
  }

  return (
    <div className="w-full max-w-[360px] mx-auto space-y-8">
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
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">Reset password</h1>
              <p className="text-sm text-text-secondary mt-1">Use your recovery key to set a new password</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Forms */}
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
            key="recovery-form"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            {recDone ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
                  <span className="text-success text-xl">✓</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">Password reset successfully</p>
                <p className="text-xs text-text-secondary">You can now sign in with your new password.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleRecovery} className="space-y-4">
                <Field id="rec-username" label="Username" value={recUsername} onChange={setRecUsername} placeholder="Your username" autoFocus />
                <Field id="rec-key" label="Recovery key" value={recKey} onChange={setRecKey} placeholder="Paste your recovery key" />
                <Field id="rec-new-pw" label="New password" type="password" value={recNewPw} onChange={setRecNewPw} placeholder="Min 8 characters" />
                <Field id="rec-confirm" label="Confirm password" type="password" value={recConfirm} onChange={setRecConfirm} placeholder="Repeat new password" />

                {recError && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5 text-center">
                    {recError}
                  </motion.p>
                )}

                <SubmitButton loading={recLoading} label="Reset password" loadingLabel="Resetting..." />

                <button
                  type="button"
                  onClick={() => { setRecovery(false); setRecError(""); setRecUsername(""); setRecKey(""); setRecNewPw(""); setRecConfirm(""); }}
                  className="w-full text-xs text-text-secondary hover:text-text-primary transition-colors text-center pt-1"
                >
                  ← Back to sign in
                </button>
              </form>
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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !username.trim() || !password) return;
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setLoading(true);
    // Pass a temporary pharmacy name — onboarding will update it
    const tempPharmacyName = `${name.trim()} Pharmacy ${Date.now().toString().slice(-4)}`;
    const err = await register({
      pharmacyName: tempPharmacyName,
      branchName: "Main Branch",
      name: name.trim(),
      username: username.trim(),
      password,
    });
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      // Trigger onboarding flow
      onRegistered();
    }
  }

  return (
    <div className="w-full max-w-[360px] mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <div className="h-6 w-6 rounded-md bg-foreground flex items-center justify-center">
            <span className="text-background text-[10px] font-bold">Rx</span>
          </div>
          <span className="text-text-primary font-semibold text-sm">SmartPharma</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Create your account</h1>
        <p className="text-sm text-text-secondary mt-1">Then we'll set up your pharmacy in the next step</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
            <span className="text-[10px] font-bold text-background">1</span>
          </div>
          <span className="text-xs font-medium text-text-primary">Account</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-1.5 opacity-40">
          <div className="h-5 w-5 rounded-full border border-border flex items-center justify-center">
            <span className="text-[10px] text-text-secondary">2</span>
          </div>
          <span className="text-xs text-text-secondary">Pharmacy</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-1.5 opacity-40">
          <div className="h-5 w-5 rounded-full border border-border flex items-center justify-center">
            <span className="text-[10px] text-text-secondary">3</span>
          </div>
          <span className="text-xs text-text-secondary">Branch</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="reg-name" label="Your full name" value={name} onChange={setName} placeholder="e.g. Ahmed Al-Rashid" autoFocus />
        <Field id="reg-username" label="Username" value={username} onChange={setUsername} placeholder="Used to sign in — no spaces" />
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
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5 text-center">
            {error}
          </motion.p>
        )}

        <SubmitButton loading={loading} label="Continue" loadingLabel="Creating account..." />

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
