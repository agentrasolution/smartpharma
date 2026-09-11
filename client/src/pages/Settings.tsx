import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database, HardDrive, Trash2, RefreshCw, CheckCircle2, XCircle,
  Cloud, CloudOff, Loader2, Link2, Link2Off, Lock, FolderOpen, RotateCcw,
  Bot, Sparkles,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDateTime, formatFileSize } from "@/lib/utils";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { AI_PRESETS, normalizeProvider } from "@/lib/aiProviders";
import type { BackupEntry, GDriveConfig } from "@/types/electron";

async function verifyAdminPassword(password: string): Promise<boolean> {
  try {
    const res = await api.auth.verifyPassword(password);
    return res.valid;
  } catch {
    return false;
  }
}

const defaultGDriveConfig: GDriveConfig = {
  clientId: "",
  clientSecret: "",
  redirectUri: "",
  refreshToken: "",
  autoUpload: false,
  connected: false,
};

export default function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [locked, setLocked] = useState(true);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [gdriveForm, setGdriveForm] = useState<GDriveConfig>(defaultGDriveConfig);
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; action: "create" | "restore"; backupName?: string }>({ open: false, action: "create" });
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [backupDirectory, setBackupDirectory] = useState("");
  const [recoveryDialog, setRecoveryDialog] = useState<{ open: boolean; phrase: string }>({ open: false, phrase: "" });
  const [deleteBackup, setDeleteBackup] = useState<string | null>(null);

  const { data: backups = [], isLoading: backupsLoading } = useQuery({
    queryKey: ["settings", "backups"],
    queryFn: api.settings.backupList,
  });

  useQuery({
    queryKey: ["settings", "backup-directory"],
    queryFn: async () => {
      const res = await api.settings.getBackupDirectory();
      setBackupDirectory(res.path);
      return res;
    },
  });

  const { data: gdriveConfig, isLoading: gdriveLoading } = useQuery({
    queryKey: ["settings", "gdrive"],
    queryFn: api.settings.gdriveGetConfig,
  });

  useEffect(() => {
    if (gdriveConfig) setGdriveForm(gdriveConfig);
  }, [gdriveConfig]);

  const backupMutation = useMutation({
    mutationFn: api.settings.backupCreate,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Backup created: ${result.name}`);
        setBackupStatus({ type: "success", message: `Backup created: ${result.name}` });
        queryClient.invalidateQueries({ queryKey: ["settings", "backups"] });
      } else {
        toast.error(result.error || "Backup failed");
        setBackupStatus({ type: "error", message: result.error || "Backup failed" });
      }
      setTimeout(() => setBackupStatus(null), 5000);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setBackupStatus({ type: "error", message: err.message });
      setTimeout(() => setBackupStatus(null), 5000);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (name: string) => api.settings.backupRestore(name),
    onSuccess: () => {
      toast.success("Database restored from backup successfully.");
      setBackupStatus({ type: "success", message: "Database restored from backup successfully." });
      queryClient.invalidateQueries({ queryKey: ["settings", "backups"] });
      setTimeout(() => setBackupStatus(null), 5000);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setBackupStatus({ type: "error", message: err.message });
      setTimeout(() => setBackupStatus(null), 5000);
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (name: string) => api.settings.backupDelete(name),
    onSuccess: () => {
      toast.success("Backup deleted");
      queryClient.invalidateQueries({ queryKey: ["settings", "backups"] });
      setDeleteBackup(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteBackup(null);
    },
  });

  const saveGdriveMutation = useMutation({
    mutationFn: (cfg: GDriveConfig) => api.settings.gdriveSaveConfig(cfg),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings", "gdrive"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  async function handleGenerateRecoveryKey() {
    try {
      const res = await api.auth.generateRecoveryKey();
      setRecoveryDialog({ open: true, phrase: res.phrase });
    } catch (err) {
      toast.error("Failed to generate recovery key");
    }
  }

  async function handlePasswordConfirmed() {
    setPasswordError("");
    const ok = await verifyAdminPassword(adminPassword);
    if (!ok) {
      setPasswordError("Incorrect admin password");
      return;
    }
    const { action, backupName } = passwordDialog;
    setPasswordDialog({ open: false, action: "create" });
    setAdminPassword("");
    if (action === "restore" && backupName) {
      restoreMutation.mutate(backupName);
    } else {
      backupMutation.mutate();
    }
  }

  function handleConnect() {
    const cfg = { ...gdriveForm, connected: true };
    saveGdriveMutation.mutate(cfg);
  }

  function handleDisconnect() {
    const cfg = { ...defaultGDriveConfig };
    setGdriveForm(cfg);
    saveGdriveMutation.mutate(cfg);
  }

  function handleSaveGdrive() {
    saveGdriveMutation.mutate(gdriveForm);
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const res = await api.auth.login(adminUser, adminPass);
      setLocked(false);
    } catch {
      setLoginError("Invalid admin credentials");
    } finally {
      setLoggingIn(false);
    }
  }

  if (locked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <Lock className="h-10 w-10 mx-auto text-accent" />
            <h1 className="text-xl font-semibold">Admin Access Required</h1>
            <p className="text-sm text-text-secondary">Enter admin credentials to access settings</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-admin-user">Username</Label>
              <Input id="settings-admin-user" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-admin-pass">Password</Label>
              <Input id="settings-admin-pass" type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
            </div>
            {loginError && <p className="text-sm text-danger">{loginError}</p>}
            <Button type="submit" className="w-full" disabled={loggingIn || !adminUser || !adminPass}>
              {loggingIn ? "Verifying..." : "Unlock Settings"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const totalBackupSize = backups.reduce((sum: number, b: BackupEntry) => sum + b.size, 0);

  return (
    <div>
      <PageHeader title="Settings" description="Manage database backups and Google Drive integration" />

      <Tabs defaultValue="backup">
        <TabsList className="mb-6">
          <TabsTrigger value="backup" className="gap-2">
            <Database className="h-4 w-4" />
            Database Backup
          </TabsTrigger>
          <TabsTrigger value="gdrive" className="gap-2">
            <HardDrive className="h-4 w-4" />
            Google Drive Settings
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            AI Provider
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5 text-accent" />
                  Create Backup
                </CardTitle>
                <CardDescription>
                  Create a backup of the entire database. Files are saved to the backups directory. Admin password required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => { setAdminPassword(""); setPasswordError(""); setPasswordDialog({ open: true, action: "create" }); }}
                    disabled={backupMutation.isPending}
                    className="gap-2"
                  >
                    {backupMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {backupMutation.isPending ? "Creating..." : "Create Backup Now"}
                  </Button>
                  {backupStatus && (
                    <div className={`flex items-center gap-2 text-sm ${backupStatus.type === "success" ? "text-success" : "text-danger"}`}>
                      {backupStatus.type === "success" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      {backupStatus.message}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FolderOpen className="h-5 w-5 text-accent" />
                  Backup Location
                </CardTitle>
                <CardDescription>
                  Choose where backup files are saved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Input
                    value={backupDirectory || "Loading..."}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button variant="outline" disabled className="gap-2 shrink-0">
                    <FolderOpen className="h-4 w-4" />
                    Change
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-accent" />
                  Recovery Key
                </CardTitle>
                <CardDescription>
                  Generate a one-time recovery key to reset your admin password if you forget it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleGenerateRecoveryKey} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Generate New Key
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5 text-accent" />
                  Backup History
                </CardTitle>
                <CardDescription>
                  {backups.length > 0
                    ? `${backups.length} backup${backups.length > 1 ? "s" : ""} — Total: ${formatFileSize(totalBackupSize)}`
                    : "No backups found"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {backupsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
                  </div>
                ) : backups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
                    <Database className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">No backups yet. Create your first backup above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {backups.map((backup: BackupEntry) => {
                      const label = backup.name
                        .replace(/^faraz-pharmacy-backup-/, "")
                        .replace(/\.db$/, "")
                        .replace(/T/, " ")
                        .replace(/-/g, ":");
                      return (
                        <div key={backup.name} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Database className="h-4 w-4 shrink-0 text-text-secondary" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">
                                {label}
                              </p>
                              <p className="text-xs text-text-secondary">
                                {formatDateTime(backup.createdAt)} — {formatFileSize(backup.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => { setAdminPassword(""); setPasswordError(""); setPasswordDialog({ open: true, action: "restore", backupName: backup.name }); }}
                              className="h-8 w-8 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
                              title="Restore from this backup"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteBackup(backup.name)}
                              className="h-8 w-8 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
                              title="Delete backup"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gdrive">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HardDrive className="h-5 w-5 text-accent" />
                Google Drive Integration
              </CardTitle>
              <CardDescription>
                Configure Google Drive API credentials to enable automatic backup uploads to your Google Drive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {gdriveLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      {gdriveForm.connected ? (
                        <Cloud className="h-8 w-8 text-accent" />
                      ) : (
                        <CloudOff className="h-8 w-8 text-text-secondary" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {gdriveForm.connected ? "Connected" : "Not Connected"}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {gdriveForm.connected
                            ? "Your Google Drive is linked. Backups can be uploaded automatically."
                            : "Link your Google Drive account to enable cloud backups."}
                        </p>
                      </div>
                    </div>
                    {gdriveForm.connected ? (
                      <Button variant="destructive" size="sm" onClick={handleDisconnect} className="gap-2">
                        <Link2Off className="h-4 w-4" />
                        Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleConnect} className="gap-2" disabled={!gdriveForm.clientId || !gdriveForm.clientSecret}>
                        <Link2 className="h-4 w-4" />
                        Connect
                      </Button>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <Label>Client ID</Label>
                      <Input
                        value={gdriveForm.clientId}
                        onChange={(e) => setGdriveForm({ ...gdriveForm, clientId: e.target.value })}
                        placeholder="Enter your Google Drive Client ID"
                      />
                    </div>
                    <div>
                      <Label>Client Secret</Label>
                      <Input
                        type="password"
                        value={gdriveForm.clientSecret}
                        onChange={(e) => setGdriveForm({ ...gdriveForm, clientSecret: e.target.value })}
                        placeholder="Enter your Google Drive Client Secret"
                      />
                    </div>
                    <div>
                      <Label>Redirect URI</Label>
                      <Input
                        value={gdriveForm.redirectUri}
                        onChange={(e) => setGdriveForm({ ...gdriveForm, redirectUri: e.target.value })}
                        placeholder="http://localhost:3456/auth/callback"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">Auto-upload backups</p>
                      <p className="text-xs text-text-secondary">
                        Automatically upload new backups to Google Drive
                      </p>
                    </div>
                    <button
                      onClick={() => setGdriveForm({ ...gdriveForm, autoUpload: !gdriveForm.autoUpload })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${gdriveForm.autoUpload ? "bg-accent" : "bg-border"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gdriveForm.autoUpload ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>

                  <Button
                    onClick={handleSaveGdrive}
                    disabled={saveGdriveMutation.isPending}
                    className="w-full"
                  >
                    {saveGdriveMutation.isPending ? "Saving..." : "Save Google Drive Settings"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-accent" />
                  LLM Provider Setup
                </CardTitle>
                <CardDescription>
                  Each LLM provider (OpenAI, Gemini, Grok, Perplexity, DeepSeek, Qwen, Custom) is configured on
                  its own dedicated setup page with API key entry and a live connection test.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {AI_PRESETS.map((preset) => (
                    <a
                      key={preset.id}
                      href={`#/settings/ai/${preset.id}`}
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-primary hover:border-accent hover:bg-accent/5 transition-colors"
                    >
                      {preset.label}
                    </a>
                  ))}
                </div>
                <Button onClick={() => navigate("/settings/ai")}>
                  <Sparkles className="h-4 w-4" />
                  Open LLM Provider Pages
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={passwordDialog.open} onOpenChange={(o) => { if (!o) { setPasswordDialog({ open: false, action: "create" }); setAdminPassword(""); setPasswordError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Admin Password Required
            </DialogTitle>
            <DialogDescription>
              {passwordDialog.action === "restore"
                ? "Restoring will overwrite the current database. Enter your admin password to confirm."
                : "Enter your admin password to create a database backup."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handlePasswordConfirmed(); }}
              />
            </div>
            {passwordError && <p className="text-sm text-danger">{passwordError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setPasswordDialog({ open: false, action: "create" }); setAdminPassword(""); setPasswordError(""); }}>Cancel</Button>
              <Button onClick={handlePasswordConfirmed} disabled={!adminPassword}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={recoveryDialog.open} onOpenChange={(o) => { if (!o) setRecoveryDialog({ open: false, phrase: "" }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Recovery Key Generated
            </DialogTitle>
            <DialogDescription>
              This is your one-time recovery key. Save it somewhere safe — it will never be shown again.
              Use it on the login screen if you forget your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-2/80 p-4">
              <p className="text-sm font-mono leading-relaxed select-all text-center">
                {recoveryDialog.phrase}
              </p>
            </div>
            <p className="text-xs text-danger text-center font-medium">
              This key will never be shown again. Write it down or save it now.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setRecoveryDialog({ open: false, phrase: "" })}>I've Saved It</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteBackup}
        onOpenChange={(v) => { if (!v) setDeleteBackup(null); }}
        title="Delete Backup"
        description="Are you sure you want to delete this backup file? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteBackup) deleteBackupMutation.mutate(deleteBackup); }}
        loading={deleteBackupMutation.isPending}
      />
    </div>
  );
}
