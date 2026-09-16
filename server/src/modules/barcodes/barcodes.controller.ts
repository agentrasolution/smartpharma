import type { Request, Response, NextFunction } from "express";
import { barcodesService } from "./barcodes.service";
import { branchScope } from "../../middleware/auth";

export const barcodesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const barcodes = await barcodesService.list({ pharmacyId: scope.pharmacyId });
      res.json(barcodes);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const barcode = await barcodesService.create({ pharmacyId: scope.pharmacyId }, req.body.code);
      res.json(barcode);
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await barcodesService.remove({ pharmacyId: scope.pharmacyId }, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
