import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body.username, req.body.password);
      res.json(result);
    } catch (err) { next(err); }
  },

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.changePassword(
        req.user!.userId,
        req.body.currentPassword,
        req.body.newPassword,
      );
      res.json(result);
    } catch (err) { next(err); }
  },

  async verifyPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyPassword(req.user!.pharmacyId, req.body.password);
      res.json(result);
    } catch (err) { next(err); }
  },

  async generateRecoveryKey(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.generateRecoveryKey(req.user!.pharmacyId);
      res.json(result);
    } catch (err) { next(err); }
  },

  async recoverPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.recoverPassword(
        req.body.username,
        req.body.phrase,
        req.body.newPassword,
      );
      res.json(result);
    } catch (err) { next(err); }
  },

  async sendVerificationEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.sendVerificationEmail(req.user!.pharmacyId, req.body.email);
      res.json(result);
    } catch (err) { next(err); }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyEmail(req.user!.pharmacyId, req.body.code);
      res.json(result);
    } catch (err) { next(err); }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.requestPasswordReset(req.body.identifier);
      res.json(result);
    } catch (err) { next(err); }
  },

  async resetPasswordOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetPasswordWithOtp(
        req.body.identifier,
        req.body.code,
        req.body.newPassword,
      );
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