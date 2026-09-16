import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import type { Prisma } from "../../generated/prisma/client";
import type { CreateBranchInput, UpdateBranchInput } from "./branches.schema";

const branchInclude = {
  users: { select: { id: true, username: true, name: true, jobRole: true, isActive: true } },
} satisfies Prisma.BranchInclude;

interface BranchListItem {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  adminCount: number;
  managerCount: number;
  stockManagerCount: number;
  salesmanCount: number;
  cashierCount: number;
  helperCount: number;
  otherCount: number;
  users: Array<{ id: string; username: string; name: string; jobRole: string; isActive: boolean }>;
}

function toListItem(b: {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  users: Array<{ id: string; username: string; name: string; jobRole: string; isActive: boolean }>;
}): BranchListItem {
  const counts = {
    adminCount: 0,
    managerCount: 0,
    stockManagerCount: 0,
    salesmanCount: 0,
    cashierCount: 0,
    helperCount: 0,
    otherCount: 0,
  };
  const users = b.users.map((u) => ({ id: u.id, username: u.username, name: u.name, jobRole: u.jobRole, isActive: u.isActive }));
  for (const u of users) {
    const key = `${u.jobRole}Count` as keyof typeof counts;
    if (key in counts) counts[key] += 1;
    else counts.otherCount += 1;
  }
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    userCount: users.length,
    ...counts,
    users,
  };
}

export const branchesService = {
  async list(pharmacyId: string) {
    const branches = await prisma.branch.findMany({
      where: { pharmacyId },
      include: branchInclude,
      orderBy: { createdAt: "asc" },
    });
    return branches.map(toListItem);
  },

  async getById(id: string, pharmacyId: string) {
    const branch = await prisma.branch.findFirst({ where: { id, pharmacyId }, include: branchInclude });
    if (!branch) throw new NotFoundError("Branch");
    return toListItem(branch);
  },

  async create(input: CreateBranchInput, pharmacyId: string) {
    const existing = await prisma.branch.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" }, pharmacyId },
    });
    if (existing) throw new BadRequestError("A branch with this name already exists");

    const branch = await prisma.branch.create({
      data: {
        pharmacyId,
        name: input.name,
        address: input.address ?? "",
        phone: input.phone ?? "",
        isActive: input.isActive ?? true,
      },
      include: branchInclude,
    });
    return toListItem(branch);
  },

  async update(id: string, input: UpdateBranchInput, pharmacyId: string) {
    const existing = await prisma.branch.findFirst({ where: { id, pharmacyId } });
    if (!existing) throw new NotFoundError("Branch");

    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      const dup = await prisma.branch.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" }, pharmacyId, id: { not: id } },
      });
      if (dup) throw new BadRequestError("A branch with this name already exists");
    }

    const data: Prisma.BranchUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.address !== undefined) data.address = input.address;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const branch = await prisma.branch.update({ where: { id }, data, include: branchInclude });
    return toListItem(branch);
  },

  async delete(id: string, pharmacyId: string) {
    const branch = await prisma.branch.findFirst({
      where: { id, pharmacyId },
      include: { _count: { select: { users: true, products: true } } },
    });
    if (!branch) throw new NotFoundError("Branch");
    if (branch._count.users > 0) {
      throw new BadRequestError(
        `Cannot delete branch "${branch.name}" because ${branch._count.users} user(s) are assigned to it. Reassign them first.`,
      );
    }
    if (branch._count.products > 0) {
      throw new BadRequestError(
        `Cannot delete branch "${branch.name}" because ${branch._count.products} product(s) belong to it. Move them first.`,
      );
    }

    await prisma.branch.delete({ where: { id } });
    return { success: true };
  },
};

export type { BranchListItem };