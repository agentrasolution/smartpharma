import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, CheckCircle2, XCircle, Loader2, RefreshCw, Sparkles, KeyRound, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { keyBelongsToProvider, presetById, normalizeProvider } from "@/lib/aiProviders";
import { api } from "@/lib/api";
import type { AIConfig, AITestResult } from "@/types";

export default function AIProviderSetupPage() {
  const { providerId = "" } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preset = presetById(providerId);

  const [form, setForm] = useState<AIConfig>({
    provider: providerId,
    apiKey: "",
    baseUrl: preset?.baseUrl ?? "",
    model: preset?.model ?? "",
  });
  const [testResult, setTestResult] = useState<AITestResult | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: aiConfig, isLoading } = useQuery({
    queryKey: ["settings", "ai"],
    queryFn: api.settings.aiGetConfig,
  });

  useEffect(() => {
    if (!aiConfig || initialized) return;
    const savedProvider = normalizeProvider(aiConfig.provider || "");
    const isSavedProvider = savedProvider === providerId;
    const candidateBaseUrl = (aiConfig.baseUrl || "").trim();
    setForm({
      provider: providerId,
      apiKey: isSavedProvider ? (aiConfig.apiKey ?? "") : "",
      baseUrl: isSavedProvider && candidateBaseUrl ? candidateBaseUrl : (preset?.baseUrl ?? ""),
      model: isSavedProvider && aiConfig.model ? aiConfig.model : (preset?.model ?? ""),
    });
    setInitialized(true);
  }, [aiConfig, providerId, preset, initialized]);

  useEffect(() => {
    setInitialized(false);
    setTestResult(null);
    setForm({
      provider: providerId,
      apiKey: "",
      baseUrl: preset?.baseUrl ?? "",
      model: preset?.model ?? "",
    });
  }, [providerId, preset]);

  const saveMutation = useMutation({
    mutationFn: (cfg: AIConfig) => api.settings.aiSaveConfig(cfg),
    onSuccess: () => {
      toast.success(`Settings saved for ${preset?.label ?? providerId}`);
      queryClient.invalidateQueries({ queryKey: ["settings", "ai"] });
      setTestResult(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: (cfg: AIConfig) => api.settings.aiTestConfig(cfg),
    onSuccess: (result) => {
      setTestResult(result);
      if (result.success) {
        toast.success(`Connection OK (${result.latencyMs ?? "?"} ms)`);
      } else {
        toast.error(result.error || "Connection failed");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!preset) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Bot className="h-10 w-10 text-text-secondary" />
        <p className="text-sm text-text-primary">Unknown provider</p>
        <Button variant="outline" onClick={() => navigate("/settings/ai")}>Back to providers</Button>
      </div>
    );
  }

  const missingConnection = normalizeProvider(aiConfig?.provider || "") !== providerId;

  function withPresetDefaults(cfg: AIConfig): AIConfig {
    return {
      ...cfg,
      baseUrl: cfg.baseUrl.trim() || preset!.baseUrl || "",
      model: cfg.model.trim() || preset!.model || "",
    };
  }

  const keyMismatch = form.apiKey.trim() !== "" && !keyBelongsToProvider(form.apiKey, providerId);
  const canTest = form.apiKey.trim() !== "" || missingConnection;

  return (
    <div>
      <PageHeader
        title={preset.label}
        description={preset.description}
        back={{ label: "All providers", onClick: () => navigate("/settings/ai") }}
        action={{ label: "Test Connection", onClick: () => { if (!canTest) return; setTestResult(null); testMutation.mutate(withPresetDefaults(form)); } }}
      />

      <div className="max-w-2xl space-y-6">
        {missingConnection && aiConfig && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-600">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            The active provider is {normalizeProvider(aiConfig.provider || "")}. Saving here switches the AI agent to {preset.label}.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-accent" />
              {preset.label}
              {!missingConnection && <Badge variant="success">Active provider</Badge>}
            </CardTitle>
            <CardDescription>
              Tier: {preset.tier}. Model: {preset.model || "custom"} via {preset.baseUrl || "your endpoint"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="provider-key">API Key</Label>
              <Input
                id="provider-key"
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={preset.keyPlaceholder}
                className="font-mono"
                autoComplete="off"
              />
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-secondary">
                <KeyRound className="h-3 w-3" />
                Stored locally in your config file. Never shared.
              </div>
              {keyMismatch && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  That key does not look like a {preset.label} key. It may be for a different provider and
                  could be rejected by {preset.label} — double-check before saving.
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="provider-base-url">Base URL</Label>
                <Input
                  id="provider-base-url"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                  className="font-mono"
                />
                <p className="text-[11px] text-text-secondary mt-1">OpenAI-compatible chat completions endpoint root.</p>
              </div>
              <div>
                <Label htmlFor="provider-model">Model</Label>
                <Input
                  id="provider-model"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="gemini-3.6-flash"
                  className="font-mono"
                />
              </div>
            </div>

            {testResult && (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                testResult.success ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-medium">
                    {testResult.success ? "Connection successful" : "Connection failed"}
                  </p>
                  {testResult.success ? (
                    <p className="text-xs opacity-80 mt-0.5">
                      {testResult.provider} · {testResult.model} · {testResult.latencyMs} ms
                    </p>
                  ) : (
                    <p className="text-xs opacity-80 mt-0.5 break-words">{testResult.error}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                onClick={() => saveMutation.mutate(withPresetDefaults(form))}
                disabled={saveMutation.isPending || testMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {saveMutation.isPending ? "Saving..." : missingConnection ? `Activate & Save ${preset.label}` : "Save Settings"}
              </Button>
              <Button
                onClick={() => { setTestResult(null); testMutation.mutate(withPresetDefaults(form)); }}
                variant="outline"
                disabled={testMutation.isPending || !canTest}
                className="gap-2"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {testMutation.isPending ? "Testing..." : "Test Connection"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {preset.id === "gemini" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gemini notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1 text-xs text-text-secondary">
                <li>Free tier has strict daily quotas (429 errors mean the quota is exhausted — wait or upgrade).</li>
                <li>The agent uses tool calls; multi-turn chats replay prior tool results.</li>
                <li>Model may need a -flash suffix (e.g. gemini-3.6-flash).</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}