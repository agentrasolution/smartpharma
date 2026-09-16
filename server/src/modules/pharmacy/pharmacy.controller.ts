import type { Request, Response, NextFunction } from "express";
import { pharmacyService } from "./pharmacy.service";

export const pharmacyController = {
  async getOwn(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await pharmacyService.getOwn(req.user!.pharmacyId));
    } catch (err) { next(err); }
  },

  async updateOwn(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await pharmacyService.updateOwn(req.user!.pharmacyId, req.body));
    } catch (err) { next(err); }
  },

  async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await pharmacyService.listAll());
    } catch (err) { next(err); }
  },

  async getAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await pharmacyService.getAdmin(req.params.id));
    } catch (err) { next(err); }
  },

  async updateSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await pharmacyService.updateSubscription(req.params.id, req.body));
    } catch (err) { next(err); }
  },
};