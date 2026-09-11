import { Router } from "express";
import { arrearsController } from "./arrears.controller";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createArrearSchema, payArrearSchema, settleArrearSchema } from "./arrears.schema";

const router = Router();

router.use(authenticate);

router.get("/", arrearsController.list);
router.post("/", validate(createArrearSchema), arrearsController.create);
router.post("/:id/pay", validate(payArrearSchema), arrearsController.recordPayment);
router.post("/:id/settle", validate(settleArrearSchema), arrearsController.settle);
router.delete("/:id", arrearsController.delete);

export { router as arrearsRoutes };
