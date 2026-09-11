import type {
  AIProvider,
  AIChatInput,
  AIChatResult,
  AIToolDefinition,
  AIChatMessage,
  AIToolCall,
} from "./ai-provider.interface";
import { AppError } from "../../utils/errors";

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string; thought_signature?: string };
        extra_content?: { google?: { thought_signature?: string } };
      }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string | number };
}

function toToolCall(raw: NonNullable<NonNullable<OpenAIResponse["choices"]>[0]["message"]>["tool_calls"]): AIToolCall[] {
  if (!raw) return [];
  const calls: AIToolCall[] = [];
  for (const tc of raw) {
    if (!tc.function?.name) continue;
    let args: Record<string, unknown> = {};
    if (tc.function.arguments) {
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }
    }
    calls.push({
      id: tc.id ?? `call-${calls.length}`,
      name: tc.function.name,
      arguments: args,
      thoughtSignature: tc.function?.thought_signature ?? tc.extra_content?.google?.thought_signature,
    });
  }
  return calls;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";

  constructor(private readonly opts: {
    apiKey: string;
    baseUrl: string;
    timeoutMs?: number;
  }) {}

  async chat(input: AIChatInput): Promise<AIChatResult> {
    const messages = input.messages.map((m) => this.toProviderMessage(m));
    const tools = input.tools.map((t) => this.toProviderTool(t));
    const deadline = Date.now() + (this.opts.timeoutMs ?? 60000);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const waitMs = Math.min(2000 * 2 ** attempt, 10000);
        if (Date.now() + waitMs > deadline) break;
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const remaining = Math.max(5000, deadline - Date.now());
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remaining);

      try {
        const res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.opts.apiKey}`,
          },
          body: JSON.stringify({
            model: input.model,
            messages,
            tools,
            temperature: input.temperature ?? 0.2,
            ...(input.tools.length > 0 ? { tool_choice: "auto" } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
            lastError = new AppError(res.status, `AI provider error (${res.status}): ${text.slice(0, 300)}`);
            continue;
          }
          throw new AppError(502, `AI provider error (${res.status}): ${text.slice(0, 300)}`);
        }

        const json = (await res.json()) as OpenAIResponse;
        if (json.error) {
          const code = Number(json.error.code ?? 0);
          if (code === 429 || code === 500 || code === 502 || code === 503 || code === 504) {
            lastError = new AppError(502, `AI provider error: ${json.error.message ?? "unknown"}`);
            continue;
          }
          throw new AppError(502, `AI provider error: ${json.error.message ?? "unknown"}`);
        }

        const message = json.choices?.[0]?.message;
        return {
          content: message?.content ?? null,
          toolCalls: toToolCall(message?.tool_calls),
          usage: {
            inputTokens: json.usage?.prompt_tokens ?? 0,
            outputTokens: json.usage?.completion_tokens ?? 0,
          },
        };
      } catch (err) {
        if (err instanceof AppError) {
          if (err.statusCode === 429 || err.statusCode >= 500) {
            lastError = err;
            continue;
          }
          throw err;
        }
        lastError = err as Error;
        continue;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new AppError(502, "AI provider request failed: exceeded retry budget");
  }

  private toProviderMessage(m: AIChatMessage): Record<string, unknown> {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        tool_call_id: m.toolCallId,
      };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: m.content ?? "",
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
            ...(tc.thoughtSignature ? { thought_signature: tc.thoughtSignature } : {}),
          },
          ...(tc.thoughtSignature
            ? { extra_content: { google: { thought_signature: tc.thoughtSignature } } }
            : {}),
        })),
      };
    }
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return { role: m.role, content };
  }

  private toProviderTool(t: AIToolDefinition): Record<string, unknown> {
    return {
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    };
  }
}