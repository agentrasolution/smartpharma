import type { Request, Response, NextFunction } from "express";
import { aiService } from "./ai.service";

export const aiController = {
  async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const { message, conversationId } = req.body;
      const user = req.user!;
      const result = await aiService.chat(user.userId, user.username, user.role, message, conversationId);
      res.json(result);
    } catch (err) { next(err); }
  },

  async conversations(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit ?? 50);
      const list = await aiService.listConversations(req.user!.userId, limit);
      res.json(list);
    } catch (err) { next(err); }
  },

  async conversationById(req: Request, res: Response, next: NextFunction) {
    try {
      const conv = await aiService.getConversation(req.params.id);
      res.json(conv);
    } catch (err) { next(err); }
  },

  async auditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit ?? 100);
      const logs = await aiService.auditLogs({ limit });
      res.json(logs);
    } catch (err) { next(err); }
  },
};