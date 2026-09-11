import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1, "Message is required").max(4000),
  conversationId: z.string().optional(),
});

export const conversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ChatInput = z.infer<typeof chatSchema>;