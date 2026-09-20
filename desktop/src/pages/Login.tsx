import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Lock, Sun, Moon, Building2, Store } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";


export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));

  const [regPharmacyName, setRegPharmacyName] = useState("");
  const [regBranchName, setRegBranchName] = useState("Main Branch");
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regContact, setRegContact] = useState("");

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("faraz_theme", next ? "dark" : "light"); } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError("");
    const err = await login(username, password);
    if (err) setError(err);
    setLoading(false);
  }

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError("");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!regPharmacyName.trim() || !regName.trim() || !regUsername.trim() || !regPassword) return;
    if (regPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (regPassword !== regConfirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const err = await register({
      pharmacyName: regPharmacyName.trim(),
      branchName: regBranchName.trim() || undefined,
      name: regName.trim(),
      username: regUsername.trim(),
      password: regPassword,
      email: regEmail.trim() || undefined,
      phone: regPhone.trim() || undefined,
      contact: regContact.trim() || undefined,
    });
    if (err) setError(err);
    setLoading(false);
  }

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryError("");
    if (!username || !recoveryPhrase || !newPassword || !confirmPassword) {
      setRecoveryError("Username, recovery key and new password are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setRecoveryError("Password must be at least 8 characters");
      return;
    }
    setRecovering(true);
    try {
      const res = await api.auth.recoverPassword(recoveryPhrase.trim(), newPassword, username.trim());
      if (res.error) {
        setRecoveryError(res.error);
      } else {
        setRecoverySuccess(true);
        setTimeout(() => {
          setRecoveryOpen(false);
          setRecoverySuccess(false);
          setRecoveryPhrase("");
          setNewPassword("");
          setConfirmPassword("");
        }, 3000);
      }
    } catch {
      setRecoveryError("Recovery failed");
    } finally {
      setRecovering(false);
    }
  }

  return (
    <div className={cn("flex min-h-screen w-full transition-all duration-700 ease-in-out", mode === "register" ? "flex-row-reverse" : "flex-row")}>
      <button
        onClick={toggleDark}
        className="fixed top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-all duration-200 z-20 bg-background/80 backdrop-blur-sm"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <motion.div layout transition={{ type: "spring", stiffness: 300, damping: 30 }} className="flex-1 flex items-center justify-center bg-background p-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="block lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div>
                <h1 className="text-base font-display font-semibold text-text-primary tracking-tight">SmartPharma</h1>
                <p className="text-[11px] text-text-secondary">Sign in to your account</p>
              </div>
            </div>
          </div>

          <form onSubmit={mode === "login" ? handleSubmit : handleRegister} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === "register" ? (
                <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pharmacy" className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> Pharmacy Name
                  </Label>
                  <Input
                    id="reg-pharmacy"
                    value={regPharmacyName}
                    onChange={(e) => setRegPharmacyName(e.target.value)}
                    placeholder="e.g. Green Cross Pharmacy"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-branch" className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                    <Store className="h-3 w-3" /> Branch Name (optional)
                  </Label>
                  <Input
                    id="reg-branch"
                    value={regBranchName}
                    onChange={(e) => setRegBranchName(e.target.value)}
                    placeholder="e.g. Main Branch"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name" className="text-xs font-medium text-text-primary">Your Name</Label>
                    <Input id="reg-name" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-username" className="text-xs font-medium text-text-primary">Username</Label>
                    <Input id="reg-username" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="Admin username" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password" className="text-xs font-medium text-text-primary">Password</Label>
                    <Input id="reg-password" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Min 8 characters" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm" className="text-xs font-medium text-text-primary">Confirm</Label>
                    <Input id="reg-confirm" type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} placeholder="Repeat password" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email" className="text-xs font-medium text-text-primary">Email (optional)</Label>
                    <Input id="reg-email" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-phone" className="text-xs font-medium text-text-primary">Phone (optional)</Label>
                    <Input id="reg-phone" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="Phone" />
                  </div>
                </div>
                <p className="text-[11px] text-text-secondary bg-surface/60 border border-border rounded-lg px-3 py-2 leading-relaxed">
                  Creates your pharmacy with a 30-day free trial. Your first account becomes the pharmacy super admin.
                </p>
                </motion.div>
            ) : (
                <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs font-medium text-text-primary">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-text-primary">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                </motion.div>
            )}
            </AnimatePresence>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-danger bg-danger/5 border border-danger/10 rounded-lg px-3 py-2 text-center"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {mode === "register" ? "Creating pharmacy..." : "Signing in..."}
                </span>
              ) : mode === "register" ? "Create pharmacy & sign in" : "Sign in"}
            </Button>

            <div className="flex items-center justify-between text-xs">
              {mode === "login" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setRecoveryOpen(true)}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="text-accent hover:text-accent-hover transition-colors font-medium"
                  >
                    New pharmacy? Sign up
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-accent hover:text-accent-hover transition-colors font-medium"
                >
                  Already have an account? Sign in
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </motion.div>

      <motion.div layout transition={{ type: "spring", stiffness: 300, damping: 30 }} className="hidden lg:flex flex-1 items-center justify-center bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-white/[0.03] rounded-[100%] -translate-y-1/2 w-[600px] h-[600px] top-0 left-1/2 -translate-x-1/2" />
        <div className="absolute inset-0 bg-black/[0.04] rounded-[100%] translate-y-1/3 w-[400px] h-[400px] bottom-0 right-0" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 text-center px-8"
        >
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">SmartPharma</h2>
          <p className="text-sm text-white/70 mt-2 max-w-xs mx-auto leading-relaxed">
            Complete pharmacy management solution
          </p>
        </motion.div>
      </motion.div>

      <Dialog open={recoveryOpen} onOpenChange={(v) => { if (!v) { setRecoveryOpen(false); setTimeout(() => { setRecoverySuccess(false); setRecoveryError(""); setRecoveryPhrase(""); setNewPassword(""); setConfirmPassword(""); }, 200); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recover Password</DialogTitle>
          </DialogHeader>
          {recoverySuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-5"
            >
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-2">
                <Lock className="h-5 w-5 text-success" />
              </div>
              <p className="text-sm text-success font-medium">Password reset successfully!</p>
              <p className="text-[11px] text-text-secondary mt-0.5">You can now sign in with your new password.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleRecoverySubmit} className="space-y-3">
              <p className="text-xs text-text-secondary">
                Enter your username and recovery key to reset your password.
              </p>
              <div className="space-y-1">
                <Label htmlFor="recovery-username" className="text-xs">Username</Label>
                <Input
                  id="recovery-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your username"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recovery-phrase" className="text-xs">Recovery Key</Label>
                <Input
                  id="recovery-phrase"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  placeholder="Paste your recovery key"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password" className="text-xs">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password" className="text-xs">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              {recoveryError && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger text-center">
                  {recoveryError}
                </motion.p>
              )}
              <Button type="submit" className="w-full" disabled={recovering || !recoveryPhrase || !newPassword || !confirmPassword}>
                {recovering ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
