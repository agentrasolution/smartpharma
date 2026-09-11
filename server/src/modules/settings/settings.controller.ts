import type { Request, Response, NextFunction } from "express";
import { settingsService } from "./settings.service";

export const settingsController = {
  // Backups
  async createBackup(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await settingsService.createBackup();
      res.json(result);
    } catch (err) { next(err); }
  },

  async listBackups(_req: Request, res: Response, next: NextFunction) {
    try {
      const backups = settingsService.listBackups();
      res.json(backups);
    } catch (err) { next(err); }
  },

  async deleteBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = settingsService.deleteBackup(req.body.name);
      res.json(result);
    } catch (err) { next(err); }
  },

  async restoreBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await settingsService.restoreBackup(req.body.name);
      res.json(result);
    } catch (err) { next(err); }
  },

  async getBackupDirectory(_req: Request, res: Response, next: NextFunction) {
    try {
      const dir = settingsService.getBackupDirectory();
      res.json(dir);
    } catch (err) { next(err); }
  },

  // Google Drive
  async getGdriveConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      const cfg = settingsService.getGdriveConfig();
      res.json(cfg);
    } catch (err) { next(err); }
  },

  async saveGdriveConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = settingsService.saveGdriveConfig(req.body);
      res.json(result);
    } catch (err) { next(err); }
  },

  // AI provider
  async getAIConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(settingsService.getAIConfig());
    } catch (err) { next(err); }
  },

  async saveAIConfig(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(settingsService.saveAIConfig(req.body));
    } catch (err) { next(err); }
  },

  async testAIConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await settingsService.testAIConnection(req.body);
      res.json(result);
    } catch (err) { next(err); }
  },
};
