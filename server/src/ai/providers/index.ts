import type { AIProvider } from "./ai-provider.interface";
import { OpenAICompatibleProvider } from "./openai.provider";
import { config } from "../../config/env";

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  cached = new OpenAICompatibleProvider({
    apiKey: config.ai.apiKey,
    baseUrl: config.ai.baseUrl,
  });
  return cached;
}

export function resetAIProviderForTest(): void {
  cached = null;
}