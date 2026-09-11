import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body.username, req.body.password);
      res.json(result);
    } catch (err) { next(err); }
  },

  async verifyPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyPassword(req.body.password);
      res.json(result);
    } catch (err) { next(err); }
  },

  async generateRecoveryKey(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.generateRecoveryKey();
      res.json(result);
    } catch (err) { next(err); }
  },

  async recoverPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.recoverPassword(req.body.phrase, req.body.newPassword);
      res.json(result);
    } catch (err) { next(err); }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      res.json(result);
    } catch (err) { next(err); }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.logout(req.body.accessToken);
      res.json(result);
    } catch (err) { next(err); }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.me(req.user!.userId);
      res.json(result);
    } catch (err) { next(err); }
  },
};
