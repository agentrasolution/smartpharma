import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Inventory module - coming soon" });
});

export { router as inventoryRoutes };
