import type { Request, Response, NextFunction } from "express";
import { customersService } from "./customers.service";
import { branchScope } from "../../middleware/auth";

export const customersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const customers = await customersService.list(scope);
      res.json(customers);
    } catch (err) { next(err); }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const q = req.query.q as string;
      if (!q) return res.json([]);
      const customers = await customersService.search(scope, q);
      res.json(customers);
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const customer = await customersService.getById(scope, req.params.id);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const customer = await customersService.create(scope, req.body);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const customer = await customersService.update(scope, req.params.id, req.body);
      res.json(customer);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const force = req.query.force === "true";
      const result = await customersService.delete(scope, req.params.id, force);
      res.json(result);
    } catch (err) { next(err); }
  },

  async getStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const statement = await customersService.getStatement(scope, req.params.id);
      res.json(statement);
    } catch (err) { next(err); }
  },

  async getRefillQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const filter = req.query.filter as "all" | "dueSoon" | "dueToday" | "overdue" | undefined;
      const queue = await customersService.getRefillQueue(scope, filter);
      res.json(queue);
    } catch (err) { next(err); }
  },

  async listChronicMedications(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const meds = await customersService.listChronicMedications(scope, req.params.id);
      res.json(meds);
    } catch (err) { next(err); }
  },

  async addChronicMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const med = await customersService.addChronicMedication(scope, req.body);
      res.json(med);
    } catch (err) { next(err); }
  },

  async updateChronicMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const med = await customersService.updateChronicMedication(scope, req.params.medId, req.body);
      res.json(med);
    } catch (err) { next(err); }
  },

  async deleteChronicMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await customersService.deleteChronicMedication(scope, req.params.medId);
      res.json(result);
    } catch (err) { next(err); }
  },

  async recordContact(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await customersService.recordContact(scope, req.params.medId, req.body.notes);
      res.json(result);
    } catch (err) { next(err); }
  },

  async recordRefill(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await customersService.recordRefill(scope, req.params.medId, req.body);
      res.json(result);
    } catch (err) { next(err); }
  },
};
