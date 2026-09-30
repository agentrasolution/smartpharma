import { Router } from "express";
import { dispensingController } from "./dispensing.controller";

export const dispensingRoutes = Router();

// Queries & Reports (must precede :id)
dispensingRoutes.get("/substitutions/suggest", dispensingController.suggestSubstitutions);
dispensingRoutes.get("/controlled-register", dispensingController.controlledRegister);

// Prescriptions CRUD & Workflows
dispensingRoutes.get("/", dispensingController.list);
dispensingRoutes.post("/", dispensingController.create);
dispensingRoutes.get("/:id", dispensingController.getById);
dispensingRoutes.post("/:id/verify", dispensingController.verify);
dispensingRoutes.post("/:id/dispense", dispensingController.dispense);
