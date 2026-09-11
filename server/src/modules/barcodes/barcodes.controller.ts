import type { Request, Response, NextFunction } from "express";
import { barcodesService } from "./barcodes.service";

export const barcodesController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const barcodes = await barcodesService.list();
      res.json(barcodes);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const barcode = await barcodesService.create(req.body.code);
      res.json(barcode);
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await barcodesService.remove(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
