import { prisma } from "../services/prisma";
import type { Prisma } from "../generated/prisma/client";
import type { AIToolCall } from "../ai/providers/ai-provider.interface";

export interface AuditRecordInput {
  userId: string | null;
  agentName: string;
  conversationId?: string | null;
  toolName?: string | null;
  action: string;
  inputJson?: unknown;
  outputJson?: unknown;
  status: "SUCCESS" | "FAILED" | "DENIED";
  approvalRequired?: boolean;
  approvalStatus?: string | null;
  approvedBy?: string | null;
  errorMessage?: string | null;
}

export const auditService = {
  async record(input: AuditRecordInput) {
    return prisma.aIAuditLog.create({
      data: {
        userId: input.userId,
        agentName: input.agentName,
        conversationId: input.conversationId ?? null,
        toolName: input.toolName ?? null,
        action: input.action,
        inputJson: input.inputJson ?? undefined,
        outputJson: input.outputJson ?? undefined,
        status: input.status,
        approvalRequired: input.approvalRequired ?? false,
        approvalStatus: input.approvalStatus ?? null,
        approvedBy: input.approvedBy ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    });
  },

  async saveMessage(data: {
    conversationId: string;
    role: string;
    content: string;
    toolName?: string | null;
    toolCallId?: string | null;
    thoughtSignature?: string | null;
    toolCalls?: AIToolCall[] | null;
  }) {
    return prisma.aIMessage.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        toolName: data.toolName ?? null,
        toolCallId: data.toolCallId ?? null,
        thoughtSignature: data.thoughtSignature ?? null,
        toolCalls: data.toolCalls && data.toolCalls.length > 0
          ? (data.toolCalls as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  },
};