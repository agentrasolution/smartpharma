import type { Request, Response, NextFunction } from "express";
import { dispensingService } from "./dispensing.service";
import { branchScope } from "../../middleware/auth";
import {
  createPrescriptionSchema,
  verifyPrescriptionSchema,
  dispensePrescriptionSchema,
  listPrescriptionsQuerySchema,
  controlledRegisterQuerySchema,
} from "./dispensing.schema";

export const dispensingController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const parsed = createPrescriptionSchema.parse(req.body);
      const result = await dispensingService.createPrescription(scope, parsed);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const query = listPrescriptionsQuerySchema.parse(req.query);
      const result = await dispensingService.listPrescriptions(scope, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await dispensingService.getPrescriptionById(scope, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const parsed = verifyPrescriptionSchema.parse(req.body);
      const user = (req as any).user;
      const pharmacist = {
        id: user?.userId || "unknown",
        name: user?.name || user?.username || "Licensed Pharmacist",
      };
      const result = await dispensingService.verifyPrescription(
        scope,
        req.params.id,
        parsed,
        pharmacist
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async suggestSubstitutions(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const productId = req.query.productId as string;
      if (!productId) {
        res.status(400).json({ error: "productId query parameter is required" });
        return;
      }
      const result = await dispensingService.suggestSubstitutions(scope, productId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async dispense(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const parsed = dispensePrescriptionSchema.parse(req.body);
      const user = (req as any).user;
      const pharmacist = {
        id: user?.userId || "unknown",
        name: user?.name || user?.username || "Licensed Pharmacist",
      };
      const result = await dispensingService.dispensePrescription(
        scope,
        req.params.id,
        parsed,
        pharmacist
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async controlledRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const query = controlledRegisterQuerySchema.parse(req.query);
      const result = await dispensingService.getControlledDrugRegister(scope, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
