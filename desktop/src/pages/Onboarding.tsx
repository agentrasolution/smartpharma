import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Building2, MapPin, FlaskConical, Coins } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import CountrySelect from "@/components/shared/CountrySelect";
import { CURRENCIES, type Country } from "@/lib/countries";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingData {
  pharmacyName: string;
  country: string;
  countryName: string;
  city: string;
  phone: string;
  currency: string;
  branchName: string;
  branchAddress: string;
  licenceNumber: string;
}

// ─── Primitives ────────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  hint,
  type = "text",
  value,
  onChange,
  placeholder,
  autoFocus,
  optional,
}: {
  id: string;
  label: string;
  hint?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
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
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={cn(
          "w-full h-10 rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-secondary/40",
          "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60",
          "transition-all duration-150",
        )}
      />
      {hint && <p className="text-[11px] text-text-secondary/70 leading-relaxed">{hint}</p>}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-medium tracking-wide uppercase text-text-secondary select-none">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full h-10 rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary",
          "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60",
          "transition-all duration-150 cursor-pointer appearance-none",
          !value && "text-text-secondary/50",
        )}
      >
        <option value="" disabled>Select country</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Step progress bar ─────────────────────────────────────────────────────────

const STEPS = [
  { icon: Building2, label: "Pharmacy" },
  { icon: MapPin, label: "Branch" },
  { icon: Check, label: "Done" },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300",
              done && "text-success",
              active && "bg-foreground text-background",
              !done && !active && "text-text-secondary/50",
            )}>
              <Icon className="h-3 w-3" />
              <span>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "h-px w-8 transition-all duration-500",
                done ? "bg-success" : "bg-border",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Pharmacy info ──────────────────────────────────────────────────────

function StepPharmacy({
  data,
  onChange,
  onNext,
  error,
  loading,
  onSkip,
}: {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
  error: string;
  loading: boolean;
  onSkip?: () => void;
}) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <motion.form
      key="step-pharmacy"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-text-primary tracking-tight">Your pharmacy</h2>
        <p className="text-sm text-text-secondary">Tell us about the business you're managing.</p>
      </div>

      <div className="space-y-4">
        <Field
          id="pharmacy-name"
          label="Pharmacy name"
          value={data.pharmacyName}
          onChange={(v) => onChange({ pharmacyName: v })}
          placeholder="e.g. Al Shifa Pharmacy"
          autoFocus
        />

        <CountrySelect
          value={data.country}
          onChange={(c: Country) =>
            onChange({
              country: c.code,
              countryName: c.name,
              currency: data.currency || c.currency,
              phone: !data.phone || data.phone.startsWith("+") ? c.dialCode + " " : data.phone,
            })
          }
          label="Country *"
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="city"
            label="City *"
            value={data.city}
            onChange={(v) => onChange({ city: v })}
            placeholder="e.g. Riyadh"
          />
          <div className="space-y-1.5">
            <label htmlFor="currency" className="block text-[11px] font-medium tracking-wide uppercase text-text-secondary select-none">
              Base Currency *
            </label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
              <select
                id="currency"
                value={data.currency}
                onChange={(e) => onChange({ currency: e.target.value })}
                className="w-full h-10 pl-8 pr-3 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60 transition-all appearance-none cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <Field
          id="phone"
          label="Pharmacy Phone"
          type="tel"
          value={data.phone}
          onChange={(v) => onChange({ phone: v })}
          placeholder="+966 50 000 0000"
          optional
        />
      </div>

      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5 text-center">
          {error}
        </motion.p>
      )}

      <button
        type="submit"
        disabled={loading || !data.pharmacyName.trim() || !data.country}
        className={cn(
          "w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2",
          "bg-foreground text-background",
          "hover:opacity-90 active:scale-[0.98]",
          "transition-all duration-150",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        Continue <ArrowRight className="h-4 w-4" />
      </button>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-xs text-text-secondary hover:text-text-primary transition-colors text-center pt-1"
        >
          Skip for now →
        </button>
      )}
    </motion.form>
  );
}

// ─── Step 2: Branch info ──────────────────────────────────────────────────────

function StepBranch({
  data,
  onChange,
  onNext,
  onBack,
  error,
  loading,
  onSkip,
}: {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  error: string;
  loading: boolean;
  onSkip?: () => void;
}) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <motion.form
      key="step-branch"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-text-primary tracking-tight">Your first branch</h2>
        <p className="text-sm text-text-secondary">You can add more branches from settings later.</p>
      </div>

      <div className="space-y-4">
        <Field
          id="branch-name"
          label="Branch name"
          value={data.branchName}
          onChange={(v) => onChange({ branchName: v })}
          placeholder="e.g. Main Branch"
          autoFocus
        />
        <Field
          id="branch-address"
          label="Address"
          value={data.branchAddress}
          onChange={(v) => onChange({ branchAddress: v })}
          placeholder="Street, district, city"
          optional
        />
        <Field
          id="licence"
          label="Pharmacy licence number"
          value={data.licenceNumber}
          onChange={(v) => onChange({ licenceNumber: v })}
          placeholder={data.country === "SA" ? "MOH licence number" : "DHA / MOHAP licence"}
          hint="You can add this later from settings. Required before processing insurance claims."
          optional
        />
      </div>

      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5 text-center">
          {error}
        </motion.p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "h-11 px-5 rounded-xl text-sm font-medium flex items-center justify-center gap-2",
            "border border-border text-text-primary",
            "hover:bg-surface-2 active:scale-[0.98]",
            "transition-all duration-150",
          )}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="submit"
          disabled={loading || !data.branchName.trim()}
          className={cn(
            "flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2",
            "bg-foreground text-background",
            "hover:opacity-90 active:scale-[0.98]",
            "transition-all duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
            Setting up...
          </>
        ) : (
          <>Finish setup <ArrowRight className="h-4 w-4" /></>
        )}
        </button>
      </div>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-xs text-text-secondary hover:text-text-primary transition-colors text-center pt-1"
        >
          Skip for now →
        </button>
      )}
    </motion.form>
  );
}

// ─── Step 3: Done ──────────────────────────────────────────────────────────────

function StepDone({ pharmacyName }: { pharmacyName: string }) {
  return (
    <motion.div
      key="step-done"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="text-center space-y-6 py-4"
    >
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
        className="h-16 w-16 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center mx-auto"
      >
        <Check className="h-8 w-8 text-success" strokeWidth={2.5} />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">You're all set</h2>
        <p className="text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">
          <span className="text-text-primary font-medium">{pharmacyName}</span> is ready. Taking you to your dashboard…
        </p>
      </div>

      {/* Animated dots */}
      <div className="flex items-center justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-accent"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Onboarding root ───────────────────────────────────────────────────────────

export default function Onboarding({ onComplete }: { onComplete?: () => void }) {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<OnboardingData>({
    pharmacyName: "",
    country: "SA",
    countryName: "Saudi Arabia",
    city: "",
    currency: "SAR",
    phone: "+966 ",
    branchName: "Main Branch",
    branchAddress: "",
    licenceNumber: "",
  });

  function patch(update: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...update }));
    setError("");
  }

  function handleStep1Next() {
    if (!data.pharmacyName.trim() || !data.country || !data.city.trim()) {
      setError("Pharmacy name, country, and city are required.");
      return;
    }
    setError("");
    setStep(1);
  }

  async function handleStep2Next() {
    if (!data.branchName.trim()) {
      setError("Branch name is required.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await api.pharmacy.updateOnboarding({
        pharmacyName: data.pharmacyName.trim(),
        country: data.country,
        countryName: data.countryName,
        city: data.city.trim(),
        currency: data.currency,
        phone: data.phone.trim(),
        branchName: data.branchName.trim(),
        branchAddress: data.branchAddress.trim(),
        licenceNumber: data.licenceNumber.trim() || undefined,
      });

      localStorage.setItem("smartpharma_currency", data.currency);
      await refreshUser();
      setStep(2);

      // Navigate to app after a short pause to show the success screen
      setTimeout(() => {
        onComplete?.();
      }, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left: Form */}
      <div className="flex flex-1 items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Logo + Step bar */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center">
                <span className="text-background text-xs font-bold">Rx</span>
              </div>
              <span className="text-text-primary font-semibold text-sm tracking-tight">SmartPharma</span>
            </div>
            <StepBar current={step} />
          </div>

          {/* Steps */}
          <AnimatePresence mode="wait">
            {step === 0 && (
              <StepPharmacy
                data={data}
                onChange={patch}
                onNext={handleStep1Next}
                error={error}
                loading={loading}
                onSkip={() => onComplete?.()}
              />
            )}
            {step === 1 && (
              <StepBranch
                data={data}
                onChange={patch}
                onNext={handleStep2Next}
                onBack={() => { setStep(0); setError(""); }}
                error={error}
                loading={loading}
                onSkip={() => onComplete?.()}
              />
            )}
            {step === 2 && <StepDone pharmacyName={data.pharmacyName} />}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Dark panel */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between bg-foreground p-10 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

        {/* Logo */}
        <div className="relative z-10">
          <FlaskConical className="h-6 w-6 text-background/40" />
        </div>

        {/* Content that changes per step */}
        <div className="relative z-10 space-y-4">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="panel-0" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="space-y-4">
                <p className="text-background/40 text-xs font-medium tracking-widest uppercase">Step 1 of 2</p>
                <h3 className="text-background text-2xl font-bold tracking-tight leading-tight">About your<br />pharmacy</h3>
                <p className="text-background/60 text-sm leading-relaxed max-w-[260px]">
                  Your country selection determines your operational jurisdiction, tax rules, and local currency.
                </p>
              </motion.div>
            )}
            {step === 1 && (
              <motion.div key="panel-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="space-y-4">
                <p className="text-background/40 text-xs font-medium tracking-widest uppercase">Step 2 of 2</p>
                <h3 className="text-background text-2xl font-bold tracking-tight leading-tight">Your first<br />branch</h3>
                <p className="text-background/60 text-sm leading-relaxed max-w-[260px]">
                  Every sale and stock record is tied to a branch. You can add more branches from settings once you&apos;re set up.
                </p>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="panel-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="space-y-4">
                <h3 className="text-background text-2xl font-bold tracking-tight leading-tight">Ready to<br />dispense.</h3>
                <p className="text-background/60 text-sm leading-relaxed max-w-[260px]">
                  Your pharmacy is configured. Head to settings whenever you&apos;re ready to configure advanced tax rules or hardware peripherals.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative z-10">
          <p className="text-background/30 text-[11px]">© {new Date().getFullYear()} SmartPharma</p>
        </div>
      </div>
    </div>
  );
}
