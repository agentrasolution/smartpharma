import type { Request, Response, NextFunction } from "express";
import { companiesService } from "./companies.service";
import { branchScope } from "../../middleware/auth";

function normalizeCompany(c: Record<string, unknown>): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    contact: c.contact,
    phone: c.phone,
    second_number: c.secondNumber ?? "",
    address: c.address,
    created_at: c.createdAt,
    product_count: (c as any)._count?.distributors ?? 0,
  };
}

export const companiesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const companies = await companiesService.list({ pharmacyId: scope.pharmacyId });
      res.json(companies.map(normalizeCompany));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const company = await companiesService.create({ pharmacyId: scope.pharmacyId }, req.body);
      res.json(normalizeCompany(company));
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const company = await companiesService.update({ pharmacyId: scope.pharmacyId }, req.params.id, req.body);
      res.json(normalizeCompany(company));
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = branchScope(req);
      const result = await companiesService.remove({ pharmacyId: scope.pharmacyId }, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
