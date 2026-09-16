import bcrypt from "bcryptjs";
import { prisma } from "../../services/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors";
import { generateTemporaryPassword } from "../../utils/password";
import type { Prisma } from "../../generated/prisma/client";
import type { CreateUserInput, UpdateUserInput, ListUsersQuery } from "./users.schema";

type Actor = { userId: string; role: string; permissions?: string[] };

interface UserListItem {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  roleId: string | null;
  roleName: string | null;
  branchId: string | null;
  branchName: string | null;
  jobRole: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const listSelect = {
  id: true,
  username: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  roleId: true,
  branchId: true,
  jobRole: true,
  isActive: true,
  mustChangePassword: true,
  passwordChangedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roleRef: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

function toListItem(u: {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  roleId: string | null;
  branchId: string | null;
  jobRole: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roleRef: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
}): UserListItem {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    roleId: u.roleId,
    roleName: u.roleRef?.name ?? null,
    branchId: u.branchId,
    branchName: u.branch?.name ?? null,
    jobRole: u.jobRole,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    passwordChangedAt: u.passwordChangedAt?.toISOString() ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

async function getRoleById(roleId: string, pharmacyId: string) {
  const role = await prisma.role.findFirst({ where: { id: roleId, pharmacyId } });
  if (!role) throw new BadRequestError("Role not found");
  return role;
}

async function getBranchById(branchId: string, pharmacyId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, pharmacyId } });
  if (!branch) throw new BadRequestError("Branch not found");
  if (!branch.isActive) throw new BadRequestError("Branch is inactive");
  return branch;
}

async function countActiveAdmins(pharmacyId: string, exceptUserId?: string): Promise<number> {
  const adminRole = await prisma.role.findFirst({
    where: { name: { equals: "Admin", mode: "insensitive" }, pharmacyId },
  });
  if (!adminRole) return 0;
  return prisma.user.count({
    where: { roleId: adminRole.id, pharmacyId, isActive: true, id: { not: exceptUserId } },
  });
}

export const usersService = {
  async list(query: ListUsersQuery, pharmacyId: string) {
    const where: Prisma.UserWhereInput = { pharmacyId };

    if (query.search) {
      where.OR = [
        { username: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.role) {
      where.roleRef = { name: { equals: query.role, mode: "insensitive" } };
    }

    if (query.branch) {
      where.branch = { id: query.branch };
    }

    if (query.status === "active") where.isActive = true;
    if (query.status === "inactive") where.isActive = false;

    const users = await prisma.user.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: "asc" },
    });

    return users.map(toListItem);
  },

  async getById(id: string, pharmacyId: string) {
    const user = await prisma.user.findFirst({
      where: { id, pharmacyId },
      select: listSelect,
    });
    if (!user) throw new NotFoundError("User");
    return toListItem(user);
  },

  async create(input: CreateUserInput, pharmacyId: string, actor: Actor) {
    const role = await getRoleById(input.roleId, pharmacyId);

    const existing = await prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new BadRequestError("Username already exists");

    if (input.branchId) await getBranchById(input.branchId, pharmacyId);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await prisma.user.create({
      data: {
        pharmacyId,
        username: input.username,
        name: input.name,
        phone: input.phone ?? "",
        email: input.email ?? "",
        role: role.name.toLowerCase(),
        roleId: role.id,
        branchId: input.branchId ?? null,
        jobRole: input.jobRole ?? "",
        passwordHash,
        isActive: input.isActive ?? true,
        mustChangePassword: false,
      },
      select: listSelect,
    });

    return { user: toListItem(user), temporaryPassword };
  },

  async update(id: string, input: UpdateUserInput, actor: Actor, pharmacyId: string) {
    const existing = await prisma.user.findFirst({ where: { id, pharmacyId } });
    if (!existing) throw new NotFoundError("User");

    if (id === actor.userId && input.isActive === false) {
      throw new ForbiddenError("You cannot deactivate your own account");
    }
    if (id === actor.userId && input.roleId && input.roleId !== existing.roleId) {
      throw new ForbiddenError("You cannot change your own role");
    }

    const data: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.jobRole !== undefined) data.jobRole = input.jobRole;
    if (input.branchId !== undefined) {
      if (input.branchId) {
        await getBranchById(input.branchId, pharmacyId);
        data.branch = { connect: { id: input.branchId } };
      } else {
        data.branch = { disconnect: true };
      }
    }

    if (input.roleId) {
      const role = await getRoleById(input.roleId, pharmacyId);
      data.role = role.name.toLowerCase();
      data.roleRef = { connect: { id: role.id } };
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: listSelect,
    });

    return toListItem(user);
  },

  async updateStatus(id: string, isActive: boolean, actor: Actor, pharmacyId: string) {
    const existing = await prisma.user.findFirst({ where: { id, pharmacyId } });
    if (!existing) throw new NotFoundError("User");

    if (id === actor.userId) {
      throw new ForbiddenError("You cannot deactivate or reactivate your own account");
    }

    if (!isActive && existing.roleId) {
      const activeAdmins = await countActiveAdmins(pharmacyId, actor.userId);
      const targetIsAdmin = (
        await prisma.role.findFirst({ where: { id: existing.roleId, pharmacyId } })
      )?.name.toLowerCase() === "admin";
      if (targetIsAdmin && activeAdmins <= 1) {
        throw new BadRequestError("Cannot deactivate the last active admin user");
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: listSelect,
    });

    // Deactivating a user invalidates their existing sessions.
    if (!isActive) {
      await prisma.authToken.deleteMany({ where: { userId: id } });
    }

    return toListItem(user);
  },

  async resetPassword(id: string, actor: Actor, pharmacyId: string) {
    const existing = await prisma.user.findFirst({ where: { id, pharmacyId } });
    if (!existing) throw new NotFoundError("User");
    if (id === actor.userId) {
      throw new ForbiddenError("Use the change password screen to update your own password");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: null,
        },
      }),
      prisma.authToken.deleteMany({ where: { userId: id } }),
    ]);

    const user = await prisma.user.findFirst({ where: { id, pharmacyId }, select: listSelect });
    if (!user) throw new NotFoundError("User");

    return { user: toListItem(user), temporaryPassword };
  },

  async delete(id: string, actor: Actor, pharmacyId: string) {
    const existing = await prisma.user.findFirst({ where: { id, pharmacyId } });
    if (!existing) throw new NotFoundError("User");
    if (id === actor.userId) {
      throw new ForbiddenError("You cannot delete your own account");
    }

    if (existing.roleId) {
      const activeAdmins = await countActiveAdmins(pharmacyId, actor.userId);
      const targetIsAdmin = (
        await prisma.role.findFirst({ where: { id: existing.roleId, pharmacyId } })
      )?.name.toLowerCase() === "admin";
      if (targetIsAdmin && activeAdmins <= 1) {
        throw new BadRequestError("Cannot deactivate the last active admin user");
      }
    }

    // Prefer soft-deactivation over hard delete so historical records that
    // reference the user (sales, expenses, audit logs) keep working.
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: listSelect,
    });
    await prisma.authToken.deleteMany({ where: { userId: id } });

    return { success: true, user: toListItem(user) };
  },
};