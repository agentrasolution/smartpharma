import { Router } from "express";
import { rolesController, permissionsController } from "./roles.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createRoleSchema, updateRoleSchema } from "./roles.schema";

const roleRouter = Router();
const permissionRouter = Router();

// Roles
roleRouter.use(authenticate);
roleRouter.get("/", authorize("users.view"), rolesController.list);
roleRouter.get("/:id", authorize("users.view"), rolesController.getById);
roleRouter.post("/", validate(createRoleSchema), authorize("users.update"), rolesController.create);
roleRouter.patch("/:id", validate(updateRoleSchema), authorize("users.update"), rolesController.update);
roleRouter.delete("/:id", authorize("users.update"), rolesController.delete);

// Permissions
permissionRouter.use(authenticate);
permissionRouter.get("/", authorize("users.view"), permissionsController.list);

export { roleRouter as rolesRoutes, permissionRouter as permissionsRoutes };