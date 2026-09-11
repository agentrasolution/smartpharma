import { Router } from "express";
import { barcodesController } from "./barcodes.controller";

const router = Router();

router.get("/", barcodesController.list);
router.post("/", barcodesController.create);
router.delete("/:id", barcodesController.remove);

export { router as barcodesRoutes };
