import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import { PERMISSIONS } from "../../constants/permissions";
import type { Prisma } from "../../generated/prisma/client";
import type { CreateRoleInput, UpdateRoleInput } from "./roles.schema";

const roleInclude = {
  permissions: { include: { permission: { select: { id: true, name: true, description: true } } } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

export const rolesService = {
  async list(pharmacyId: string) {
    const roles = await prisma.role.findMany({
      where: { pharmacyId },
      include: roleInclude,
      orderBy: { createdAt: "asc" },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      permissions: r.permissions.map((rp) => rp.permission),
      userCount: r._count.users,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  },

  async getById(id: string, pharmacyId: string) {
    const role = await prisma.role.findFirst({ where: { id, pharmacyId }, include: roleInclude });
    if (!role) throw new NotFoundError("Role");
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions.map((rp) => rp.permission),
      userCount: role._count.users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  },

  async create(input: CreateRoleInput, pharmacyId: string) {
    const existing = await prisma.role.findFirst({ where: { name: input.name, pharmacyId } });
    if (existing) throw new BadRequestError("A role with this name already exists");

    const role = await prisma.role.create({
      data: {
        pharmacyId,
        name: input.name,
        description: input.description ?? "",
        permissions: {
          create: input.permissionNames.map((name) => ({ permission: { connect: { name } } })),
        },
      },
      include: roleInclude,
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions.map((rp) => rp.permission),
      userCount: role._count.users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  },

  async update(id: string, input: UpdateRoleInput, pharmacyId: string) {
    const existing = await prisma.role.findFirst({ where: { id, pharmacyId } });
    if (!existing) throw new NotFoundError("Role");

    const data: Prisma.RoleUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;

    if (input.permissionNames !== undefined) {
      data.permissions = {
        deleteMany: {},
        create: input.permissionNames.map((name) => ({ permission: { connect: { name } } })),
      };
    }

    const role = await prisma.role.update({
      where: { id },
      data,
      include: roleInclude,
    });

    // Keep the legacy role string on assigned users in sync with a rename.
    if (input.name !== undefined && input.name !== existing.name) {
      await prisma.user.updateMany({
        where: { roleId: id },
        data: { role: input.name.toLowerCase() },
      });
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions.map((rp) => rp.permission),
      userCount: role._count.users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  },

  async delete(id: string, pharmacyId: string) {
    const role = await prisma.role.findFirst({
      where: { id, pharmacyId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundError("Role");
    if (role._count.users > 0) {
      throw new BadRequestError(
        `Cannot delete role "${role.name}" because it is assigned to ${role._count.users} user(s). Reassign them first.`,
      );
    }

    await prisma.role.delete({ where: { id } });
    return { success: true };
  },

  /** All known permissions supported by the system (canonical list). */
  allPermissions() {
    return PERMISSIONS;
  },
};