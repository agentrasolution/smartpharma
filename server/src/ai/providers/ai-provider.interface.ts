// AI provider abstraction (spec #111). The rest of the app depends only on
// this interface so provider-specific code never leaks into business logic.

export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  thoughtSignature?: string;
}

export interface AIChatMessage {
  role: AIMessageRole;
  content: string | null;
  toolCalls?: AIToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface AIChatInput {
  model: string;
  systemPrompt: string;
  messages: AIChatMessage[];
  tools: AIToolDefinition[];
  temperature?: number;
}

export interface AIChatResult {
  content: string | null;
  toolCalls: AIToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIProvider {
  readonly name: string;
  chat(input: AIChatInput): Promise<AIChatResult>;
}