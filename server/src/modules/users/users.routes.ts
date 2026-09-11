import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Users module - coming soon" });
});

export { router as usersRoutes };
