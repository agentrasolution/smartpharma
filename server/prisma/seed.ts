import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, DEFAULT_ROLES } from "../src/constants/permissions";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ---- 1. Permissions: idempotent upsert by name ----
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: { name: permission.name, description: permission.description },
    });
  }
  console.log(`Upserted ${PERMISSIONS.length} permissions`);

  // ---- 2. Default roles within each pharmacy (idempotent) ----
  const pharmacies = await prisma.pharmacy.findMany();
  if (pharmacies.length === 0) {
    console.log("No pharmacies found; seed admin role requires a pharmacy. Skipping roles/admin.");
    return;
  }

  for (const pharmacy of pharmacies) {
    for (const role of DEFAULT_ROLES) {
      const existing = await prisma.role.findFirst({
        where: { name: role.name, pharmacyId: pharmacy.id },
        include: { permissions: { include: { permission: true } } },
      });
      if (!existing) {
        const permissionNames = Array.from(new Set(role.permissions));
        await prisma.role.create({
          data: {
            name: role.name,
            description: role.description,
            pharmacyId: pharmacy.id,
            permissions: {
              create: permissionNames.map((permissionName) => ({
                permission: { connect: { name: permissionName } },
              })),
            },
          },
        });
        console.log(`Created role "${role.name}" for pharmacy "${pharmacy.name}"`);
        continue;
      }

      // Backfill any newly-added permissions onto existing roles so upgrades
      // (e.g. new modules) take effect without resetting the database.
      const missing = role.permissions.filter(
        (permissionName) =>
          !existing.permissions.some((rp) => rp.permission.name === permissionName),
      );
      if (missing.length > 0) {
        await prisma.role.update({
          where: { id: existing.id },
          data: {
            permissions: {
              create: missing.map((permissionName) => ({
                permission: { connect: { name: permissionName } },
              })),
            },
          },
        });
        console.log(`Backfilled ${missing.length} permission(s) for role "${role.name}" in pharmacy "${pharmacy.name}"`);
      }
    }
  }

  // ---- 3. Admin user for the first pharmacy: create if missing ----
  const firstPharmacy = pharmacies[0]!;
  const adminRole = await prisma.role.findFirst({
    where: { name: "Admin", pharmacyId: firstPharmacy.id },
  });
  if (!adminRole) throw new Error('Could not locate the "Admin" role');

  const existingAdmin = await prisma.user.findFirst({
    where: { username: "admin", pharmacyId: firstPharmacy.id },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        username: "admin",
        name: "Administrator",
        pharmacyId: firstPharmacy.id,
        passwordHash,
        role: "admin",
        roleId: adminRole.id,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        isActive: true,
      },
    });
    console.log(`Created admin user (username: admin, password: admin123) for pharmacy "${firstPharmacy.name}"`);
    return;
  }

  const updates: Record<string, unknown> = { roleId: adminRole.id };
  if (!existingAdmin.roleId) updates.role = "admin";
  if (existingAdmin.roleId !== adminRole.id) {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: updates });
    console.log("Backfilled admin user RBAC binding");
  } else {
    console.log("Admin user already correctly bound, skipping");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());