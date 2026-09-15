import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Lock, Sun, Moon } from "lucide-react";
import { api } from "@/lib/api";
import logoSrc from "@/asset/image/logo.png";

export default function Login() {
  const { login } = useAuth();
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

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryError("");
    if (!recoveryPhrase || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setRecoveryError("Passwords do not match");
      return;
    }
    if (newPassword.length < 4) {
      setRecoveryError("Password must be at least 4 characters");
      return;
    }
    setRecovering(true);
    try {
      const res = await api.auth.recoverPassword(recoveryPhrase.trim(), newPassword);
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
    <div className="flex min-h-screen">
      <button
        onClick={toggleDark}
        className="fixed top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-all duration-200 z-20 bg-background/80 backdrop-blur-sm"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="block lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center">
                <img src={logoSrc} alt="" className="h-6 w-6 object-cover" />
              </div>
              <div>
                <h1 className="text-base font-display font-semibold text-text-primary tracking-tight">Faraz Pharmacy</h1>
                <p className="text-[11px] text-text-secondary">Sign in to your account</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  Signing in...
                </span>
              ) : "Sign in"}
            </Button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRecoveryOpen(true)}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0D9488] relative overflow-hidden">
        <div className="absolute inset-0 bg-white/[0.03] rounded-[100%] -translate-y-1/2 w-[600px] h-[600px] top-0 left-1/2 -translate-x-1/2" />
        <div className="absolute inset-0 bg-black/[0.04] rounded-[100%] translate-y-1/3 w-[400px] h-[400px] bottom-0 right-0" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 text-center px-8"
        >
          <div className="w-32 h-32 p-5 mx-auto mb-6 rounded-xl bg-white/90 flex items-center justify-center">
            <img src={logoSrc} alt="Faraz Pharmacy" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">Faraz Pharmacy</h2>
          <p className="text-sm text-white/70 mt-2 max-w-xs mx-auto leading-relaxed">
            Complete pharmacy management solution
          </p>
        </motion.div>
      </div>

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
              <p className="text-xs text-text-secondary">Enter your recovery key to reset your password.</p>
              <div className="space-y-1">
                <Label htmlFor="recovery-phrase" className="text-xs">Recovery Key</Label>
                <Input
                  id="recovery-phrase"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  placeholder="Paste your recovery key"
                  className="font-mono text-xs"
                  autoFocus
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
