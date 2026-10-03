import { Router } from "express";
import { supplierReturnsController } from "./supplier-returns.controller";

export const supplierReturnsRoutes = Router();

// Candidates for returns (near expiry, recalled, expired)
supplierReturnsRoutes.get("/candidates", supplierReturnsController.getCandidates);

// List & Create
supplierReturnsRoutes.get("/", supplierReturnsController.list);
supplierReturnsRoutes.post("/", supplierReturnsController.create);

// Detail & Actions
supplierReturnsRoutes.get("/:id", supplierReturnsController.getById);
supplierReturnsRoutes.post("/:id/approve", supplierReturnsController.approve);
supplierReturnsRoutes.post("/:id/reject", supplierReturnsController.reject);
