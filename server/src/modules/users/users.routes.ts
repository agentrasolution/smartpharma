import { Router } from "express";
import { usersController } from "./users.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createUserSchema,
  updateUserSchema,
  userStatusSchema,
  listUsersQuerySchema,
} from "./users.schema";

const router = Router();

router.use(authenticate);

router.get("/", validate(listUsersQuerySchema, "query"), authorize("users.view"), usersController.list);
router.get("/:id", authorize("users.view"), usersController.getById);
router.post("/", validate(createUserSchema), authorize("users.create"), usersController.create);
router.patch("/:id", validate(updateUserSchema), authorize("users.update"), usersController.update);
router.patch("/:id/status", validate(userStatusSchema), authorize("users.update"), usersController.updateStatus);
router.post("/:id/reset-password", authorize("users.reset_password"), usersController.resetPassword);
router.delete("/:id", authorize("users.delete"), usersController.delete);

export { router as usersRoutes };