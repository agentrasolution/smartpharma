import { Router } from "express";
import { salesController } from "./sales.controller";
import { validate } from "../../middleware/validate";
import { createSaleSchema } from "./sales.schema";

const router = Router();

router.post("/", validate(createSaleSchema), salesController.create);
router.get("/recent", salesController.listRecent);
router.get("/search", salesController.search);
router.get("/date/:date", salesController.listByDate);
router.get("/", salesController.listAll);
router.get("/:id", salesController.getById);

export { router as salesRoutes };
