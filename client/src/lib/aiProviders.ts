export interface AIProviderPreset {
  id: string;
  label: string;
  description: string;
  baseUrl: string;
  model: string;
  tier: string;
  keyPrefix?: string;
  keyPlaceholder: string;
}

export const AI_PRESETS: AIProviderPreset[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Gemini via the OpenAI-compatible endpoint (free tier)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.6-flash",
    tier: "Free",
    keyPrefix: "AIzaSy",
    keyPlaceholder: "AIzaSy...",
  },
];

export const KEY_PREFIX_HINTS: { prefix: string; provider: string; message: string }[] = [
  { prefix: "AIza", provider: "gemini", message: "This looks like a Google Gemini key." },
  { prefix: "AQ.", provider: "gemini", message: "This looks like a Google Gemini key." },
];

export function detectKeyProviderHint(key: string): string | undefined {
  if (!key.trim()) return undefined;
  for (const hint of KEY_PREFIX_HINTS) {
    if (key.trim().startsWith(hint.prefix)) return hint.provider;
  }
  return undefined;
}

export function presetById(id: string): AIProviderPreset | undefined {
  return AI_PRESETS.find((p) => p.id === id);
}

export function normalizeProvider(provider: string): string {
  if (!provider || provider === "openai-compatible") return "openai";
  if (!presetById(provider)) return "custom";
  return provider;
}

export function keyBelongsToProvider(key: string, providerId: string): boolean {
  const hint = detectKeyProviderHint(key);
  if (!hint) return true;
  return hint === providerId;
}