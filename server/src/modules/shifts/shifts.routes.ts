import { Router } from "express";
import { shiftsController } from "./shifts.controller";

export const shiftsRoutes = Router();

// Active shift & X-report (must precede :id)
shiftsRoutes.get("/active", shiftsController.getActive);
shiftsRoutes.post("/open", shiftsController.open);
shiftsRoutes.post("/drop", shiftsController.drop);
shiftsRoutes.get("/:id/x-report", shiftsController.getXReport);
shiftsRoutes.post("/:id/close", shiftsController.close);

// Shift history & details
shiftsRoutes.get("/", shiftsController.list);
shiftsRoutes.get("/:id", shiftsController.getById);
