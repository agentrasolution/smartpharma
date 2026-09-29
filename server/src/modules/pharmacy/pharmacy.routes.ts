import { Router } from "express";
import { pharmacyController } from "./pharmacy.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { updatePharmacySchema, updateSubscriptionSchema, onboardingSchema } from "./pharmacy.schema";

const router = Router();

// Self-service tenant endpoints. The subscription guard is intentionally NOT
// applied here so that an admin can still view/manage billing while expired.
router.get("/", authenticate, authorize("pharmacy.view"), pharmacyController.getOwn);
router.patch("/", authenticate, authorize("pharmacy.update"), validate(updatePharmacySchema), pharmacyController.updateOwn);
// Onboarding: called once after registration to set pharmacy name, country, and branch details.
// No permission gate — any authenticated user who just registered can call this.
router.post("/onboarding", authenticate, validate(onboardingSchema), pharmacyController.onboard);

// Platform billing management (requires billing.manage)
router.get("/admin/pharmacies", authenticate, authorize("billing.manage"), pharmacyController.listAll);
router.get("/admin/pharmacies/:id", authenticate, authorize("billing.manage"), pharmacyController.getAdmin);
router.patch(
  "/admin/pharmacies/:id/subscription",
  authenticate,
  authorize("billing.manage"),
  validate(updateSubscriptionSchema),
  pharmacyController.updateSubscription,
);

export { router as pharmacyRoutes };