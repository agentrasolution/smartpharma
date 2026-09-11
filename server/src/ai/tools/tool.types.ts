import type { z } from "zod";

// The AI tool boundary. The AI only ever sees ToolResult objects.
// The backend (services) is the source of truth.

export interface ToolContext {
  userId: string | null;
  username: string;
  role: string;
  conversationId?: string | null;
  agentName: string;
  requestId: string;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data: T | null;
  error?: { code: string; message: string };
  metadata: {
    generatedAt: string;
  };
}

export function ok<T>(data: T): ToolResult<T> {
  return { success: true, data, metadata: { generatedAt: new Date().toISOString() } };
}

export function fail(code: string, message: string): ToolResult<null> {
  return { success: false, data: null, error: { code, message }, metadata: { generatedAt: new Date().toISOString() } };
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  permission: string;
  requiresApproval: boolean;
  execute(context: ToolContext, input: Record<string, unknown>): Promise<ToolResult<unknown>>;
}