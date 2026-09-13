import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bot, CheckCircle2, ChevronRight, KeyRound, Settings2, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { AI_PRESETS, presetById, normalizeProvider } from "@/lib/aiProviders";
import { api } from "@/lib/api";

export default function AIProvidersIndex() {
  const navigate = useNavigate();

  const { data: aiConfig, isLoading } = useQuery({
    queryKey: ["settings", "ai"],
    queryFn: api.settings.aiGetConfig,
  });

  const activeProvider = aiConfig ? normalizeProvider(aiConfig.provider || "") : null;

  return (
    <div>
      <PageHeader
        title="LLM Provider Setup"
        description="Each provider gets its own setup page. Pick a provider, enter its API key, and save. The active provider drives the AI Inventory Agent."
        action={{ label: "Refresh", onClick: () => window.location.reload() }}
      />

      <div className="max-w-3xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {AI_PRESETS.map((preset) => {
              const isActive = activeProvider === preset.id;
              const keyConfigured = Boolean(aiConfig?.apiKey);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => navigate(`/settings/ai/${preset.id}`)}
                  className={`group relative flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all ${
                    isActive
                      ? "border-accent bg-accent/5"
                      : "border-border bg-surface hover:bg-surface-2/50 hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0">
                        <Bot className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{preset.label}</p>
                        <p className="text-[11px] text-text-secondary">{preset.tier}</p>
                      </div>
                    </div>
                    {isActive ? (
                      <span className="flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-text-secondary group-hover:text-accent transition-colors" />
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{preset.description}</p>
                  <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                    {isActive ? (
                      keyConfigured ? (
                        <>
                          <KeyRound className="h-3 w-3 text-success" />
                          API key configured
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-3 w-3 text-amber-500" />
                          No API key set yet
                        </>
                      )
                    ) : (
                      <>
                        <Settings2 className="h-3 w-3" />
                        {preset.keyPrefix
                          ? `Keys start with ${preset.keyPrefix}`
                          : "OpenAI-compatible endpoint"}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeProvider && aiConfig && (
          <div className="mt-6 rounded-xl border border-border bg-surface p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-text-secondary">Currently configured</p>
              <p className="text-sm font-semibold text-text-primary truncate">
                {presetById(activeProvider)?.label ?? activeProvider}{" "}
                <span className="text-text-secondary font-normal">
                  · {aiConfig.model || "no model"} · {activeProvider}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}