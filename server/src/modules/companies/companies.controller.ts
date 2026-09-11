import type { Request, Response, NextFunction } from "express";
import { companiesService } from "./companies.service";

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
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const companies = await companiesService.list();
      res.json(companies.map(normalizeCompany));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await companiesService.create(req.body);
      res.json(normalizeCompany(company));
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await companiesService.update(req.params.id, req.body);
      res.json(normalizeCompany(company));
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await companiesService.remove(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  },
};
