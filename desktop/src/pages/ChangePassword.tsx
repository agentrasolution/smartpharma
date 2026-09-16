import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function ChangePassword() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (showConfirm) {
      setSaving(true);
      try {
        const res = await api.auth.changePassword(currentPassword, newPassword);
        toast.success("Password updated. Please sign in with your new password.");
        await logout();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to change password");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setShowConfirm(true);
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your account password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showConfirm ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <KeyRound className="h-4 w-4 text-success" />
                <span>Ready to update your password.</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowConfirm(false)} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                  {saving ? "Updating..." : "Confirm & Continue"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password" className="text-xs font-medium text-text-primary">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-medium text-text-primary">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters with letters and numbers"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-medium text-text-primary">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!currentPassword || !newPassword || !confirmPassword}
              >
                Continue
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
