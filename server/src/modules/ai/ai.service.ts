import { prisma } from "../../services/prisma";
import { NotFoundError } from "../../utils/errors";
import type { AIChatMessage, AIToolCall } from "../../ai/providers/ai-provider.interface";
import { OpenAICompatibleProvider } from "../../ai/providers/openai.provider";
import { InventoryAgent } from "../../ai/agents/inventory/inventory.agent";
import { auditService } from "../../audit/audit.service";
import { settingsService } from "../settings/settings.service";
import { randomUUID } from "crypto";
import type { BranchScope } from "../../middleware/auth";

function buildAgent() {
  const aiCfg = settingsService.getAIConfig();
  const provider = new OpenAICompatibleProvider({ apiKey: aiCfg.apiKey, baseUrl: aiCfg.baseUrl });
  return new InventoryAgent(provider, aiCfg.model);
}

interface MessageRow {
  role: string;
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  toolCalls: unknown;
}

function toChatMessage(msg: MessageRow): AIChatMessage {
  if (msg.role === "tool") {
    return { role: "tool", content: msg.content, toolCallId: msg.toolCallId ?? undefined, name: msg.toolName ?? undefined };
  }
  if (msg.role === "assistant" && Array.isArray(msg.toolCalls)) {
    return {
      role: "assistant",
      content: msg.content,
      toolCalls: (msg.toolCalls as AIToolCall[]).map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments ?? {},
        thoughtSignature: tc.thoughtSignature,
      })),
    };
  }
  return { role: msg.role as AIChatMessage["role"], content: msg.content };
}

export const aiService = {
  async chat(
    scope: BranchScope,
    userId: string,
    username: string,
    role: string,
    message: string,
    conversationId?: string,
  ) {
    const requestId = randomUUID();

    // A conversation can only be resumed by the user who owns it.
    let conv = conversationId
      ? await prisma.aIConversation.findFirst({ where: { id: conversationId, userId } })
      : null;
    if (conversationId && !conv) throw new NotFoundError("Conversation");

    if (!conv) {
      conv = await prisma.aIConversation.create({
        data: { userId, title: message.slice(0, 60) },
      });
    }

    await auditService.saveMessage({ conversationId: conv.id, role: "user", content: message });

    const historyRows = await prisma.aIMessage.findMany({
      where: { conversationId: conv.id, role: { in: ["user", "assistant", "tool"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { role: true, content: true, toolName: true, toolCallId: true, toolCalls: true },
    });
    const history = historyRows.map(toChatMessage);

    const result = await buildAgent().run(
      {
        userId,
        username,
        role,
        agentName: "InventoryAgent",
        requestId,
        pharmacyId: scope.pharmacyId,
        branchId: scope.branchId ?? null,
      },
      { conversationId: conv.id, history },
      message,
    );

    await prisma.aIConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    await auditService.record({
      userId,
      agentName: "InventoryAgent",
      conversationId: conv.id,
      toolName: null,
      action: "chat",
      inputJson: { message },
      outputJson: { content: result.content },
      status: "SUCCESS",
    });

    return { reply: result.content, conversationId: conv.id, toolCalls: result.toolCalls };
  },

  async listConversations(userId: string, limit = 50) {
    return prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { _count: { select: { messages: true } } },
    });
  },

  async getConversation(id: string, userId: string) {
    const conv = await prisma.aIConversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, toolName: true, toolCallId: true, toolCalls: true, createdAt: true },
        },
      },
    });
    if (!conv) throw new NotFoundError("Conversation");
    return conv;
  },

  async auditLogs(opts?: { limit?: number }) {
    return prisma.aIAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 100,
      select: {
        id: true,
        agentName: true,
        conversationId: true,
        toolName: true,
        action: true,
        status: true,
        approvalRequired: true,
        approvalStatus: true,
        approvedBy: true,
        errorMessage: true,
        createdAt: true,
      },
    });
  },
};