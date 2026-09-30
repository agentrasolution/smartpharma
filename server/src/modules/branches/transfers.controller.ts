import type { Request, Response, NextFunction } from "express";
import { transfersService } from "./transfers.service";
import type { AuthenticatedRequest } from "../../middleware/auth";

export const transfersController = {
  async createTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const user = {
        id: req.user!.id,
        name: req.user!.name || req.user!.username,
      };
      const result = await transfersService.createTransfer(scope, req.body, user);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async sendTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const user = {
        id: req.user!.id,
        name: req.user!.name || req.user!.username,
      };
      const result = await transfersService.sendTransfer(scope, req.params.id, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async receiveTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const user = {
        id: req.user!.id,
        name: req.user!.name || req.user!.username,
      };
      const result = await transfersService.receiveTransfer(scope, req.params.id, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async rejectTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const user = {
        id: req.user!.id,
        name: req.user!.name || req.user!.username,
      };
      const reason = req.body?.rejectionReason || req.body?.reason || "Rejected by user";
      const result = await transfersService.rejectTransfer(scope, req.params.id, reason, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async cancelTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const user = {
        id: req.user!.id,
        name: req.user!.name || req.user!.username,
      };
      const result = await transfersService.cancelTransfer(scope, req.params.id, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async listTransfers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const opts = {
        branchId: req.query.branchId as string | undefined,
        direction: req.query.direction as "in" | "out" | "all" | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
      };
      const result = await transfersService.listTransfers(scope, opts);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getTransferById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const result = await transfersService.getTransferById(scope, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getCrossBranchStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const query = {
        productId: (req.query.productId as string) || (req.params.productId as string),
        barcode: req.query.barcode as string | undefined,
      };
      const result = await transfersService.getCrossBranchStock(scope, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getBranchPriceOverrides(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const branchId = req.params.branchId;
      const result = await transfersService.getBranchPriceOverrides(scope, branchId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async setBranchPriceOverride(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const branchId = req.params.branchId;
      const result = await transfersService.setBranchPriceOverride(scope, branchId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async deleteBranchPriceOverride(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = req.branchScope!;
      const branchId = req.params.branchId;
      const productId = req.params.productId;
      const result = await transfersService.deleteBranchPriceOverride(scope, branchId, productId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
