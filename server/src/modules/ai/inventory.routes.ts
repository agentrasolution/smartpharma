import { Router } from "express";
import { aiInventoryController } from "./inventory.controller";
import { authenticate } from "../../middleware/auth";

const router = Router();

// All inventory intelligence endpoints require authentication (spec #71).
router.use(authenticate);

router.get("/summary", aiInventoryController.summary);
router.get("/products", aiInventoryController.products);
router.get("/products/:id", aiInventoryController.productDetail);
router.get("/recommendations", aiInventoryController.recommendations);
router.get("/recommendations/summary", aiInventoryController.recommendationsSummary);
router.post("/recommendations/run", aiInventoryController.runRecommendations);
router.patch("/recommendations/:id/acknowledge", aiInventoryController.acknowledgeRecommendation);
router.patch("/recommendations/:id/dismiss", aiInventoryController.dismissRecommendation);
router.get("/reorder-candidates", aiInventoryController.reorderCandidates);
router.get("/critical", aiInventoryController.critical);
router.get("/overstock", aiInventoryController.overstock);
router.get("/slow-moving", aiInventoryController.slowMoving);
router.get("/expiry", aiInventoryController.expiry);
router.get("/data-quality", aiInventoryController.dataQuality);

export { router as aiInventoryRoutes };