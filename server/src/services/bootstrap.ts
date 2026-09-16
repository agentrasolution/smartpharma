import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { config } from "../config/env";
import { PERMISSIONS, ALL_PERMISSION_NAMES } from "../constants/permissions";
import { logger } from "../utils/logger";

/**
 * Boots up the shared platform essentials on server start:
 * - ensures the global permission catalog exists (idempotent)
 * - ensures the Platform pharmacy + Platform Admin role + platform user exist
 *   so `billing.manage` routes are reachable.
 */
export async function bootstrapPlatform(): Promise<void> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: { name: permission.name, description: permission.description },
    });
  }

  const password = config.platformAdmin.password;
  if (!password) {
    return;
  }

  const pharmacy = await prisma.pharmacy.upsert({
    where: { slug: config.platformAdmin.pharmacySlug },
    update: {},
    create: {
      name: config.platformAdmin.pharmacyName,
      slug: config.platformAdmin.pharmacySlug,
    },
  });

  const role = await prisma.role.upsert({
    where: {
      pharmacyId_name: { pharmacyId: pharmacy.id, name: "Platform Admin" },
    },
    update: {},
    create: {
      name: "Platform Admin",
      description: "Platform-level administrator that manages tenants and billing",
      pharmacyId: pharmacy.id,
      permissions: {
        create: ALL_PERMISSION_NAMES.map((permissionName) => ({
          permission: { connect: { name: permissionName } },
        })),
      },
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username: config.platformAdmin.username },
    update: {},
    create: {
      username: config.platformAdmin.username,
      name: "Platform Administrator",
      pharmacyId: pharmacy.id,
      passwordHash,
      role: "platform",
      roleId: role.id,
      jobRole: "admin",
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      isActive: true,
    },
  });

  logger.info(`Platform admin "${config.platformAdmin.username}" ready`);
}