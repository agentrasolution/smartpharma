import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import type { UpdatePharmacyInput, UpdateSubscriptionInput } from "./pharmacy.schema";

export interface SerializableSubscription {
  id: string;
  pharmacyId: string;
  plan: string;
  price: number;
  status: string;
  startedAt: string;
  renewsAt: string | null;
  cancelledAt: string | null;
}

function serializeSubscription(sub: {
  id: string;
  pharmacyId: string;
  plan: string;
  price: number;
  status: string;
  startedAt: Date;
  renewsAt: Date;
  cancelledAt: Date | null;
}): SerializableSubscription {
  return {
    id: sub.id,
    pharmacyId: sub.pharmacyId,
    plan: sub.plan,
    price: sub.price,
    status: sub.status,
    startedAt: sub.startedAt.toISOString(),
    renewsAt: sub.renewsAt.toISOString(),
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
  };
}

export const pharmacyService = {
  async getOwn(pharmacyId: string) {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
      include: {
        subscription: true,
        _count: { select: { branches: true, users: true, products: true, roles: true } },
      },
    });
    if (!pharmacy) throw new NotFoundError("Pharmacy");
    if (pharmacy.subscription) {
      void serializeSubscription(pharmacy.subscription);
    }
    return {
      id: pharmacy.id,
      name: pharmacy.name,
      slug: pharmacy.slug,
      contact: pharmacy.contact,
      phone: pharmacy.phone,
      email: pharmacy.email,
      address: pharmacy.address,
      isActive: pharmacy.isActive,
      createdAt: pharmacy.createdAt.toISOString(),
      counts: pharmacy._count,
      subscription: pharmacy.subscription ? serializeSubscription(pharmacy.subscription) : null,
    };
  },

  async updateOwn(pharmacyId: string, input: UpdatePharmacyInput) {
    const data: Record<string, string> = {};
    for (const key of ["name", "contact", "phone", "email", "address"] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }

    if (data.name) {
      const clash = await prisma.pharmacy.findFirst({
        where: { name: data.name, id: { not: pharmacyId } },
      });
      if (clash) throw new BadRequestError("Another pharmacy already uses this name");
    }

    const pharmacy = await prisma.pharmacy.update({
      where: { id: pharmacyId },
      data,
      include: { subscription: true, _count: { select: { branches: true, users: true, products: true } } },
    });

    return {
      id: pharmacy.id,
      name: pharmacy.name,
      slug: pharmacy.slug,
      contact: pharmacy.contact,
      phone: pharmacy.phone,
      email: pharmacy.email,
      address: pharmacy.address,
      isActive: pharmacy.isActive,
      createdAt: pharmacy.createdAt.toISOString(),
      counts: pharmacy._count,
      subscription: pharmacy.subscription ? serializeSubscription(pharmacy.subscription) : null,
    };
  },

  // ---- Platform billing management ----

  async listAll() {
    const pharmacies = await prisma.pharmacy.findMany({
      include: {
        subscription: true,
        _count: { select: { branches: true, users: true, products: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return pharmacies.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      contact: p.contact,
      phone: p.phone,
      email: p.email,
      address: p.address,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      counts: p._count,
      subscription: p.subscription ? serializeSubscription(p.subscription) : null,
    }));
  },

  async getAdmin(pharmacyId: string) {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
      include: { subscription: true },
    });
    if (!pharmacy) throw new NotFoundError("Pharmacy");
    return {
      id: pharmacy.id,
      name: pharmacy.name,
      slug: pharmacy.slug,
      contact: pharmacy.contact,
      phone: pharmacy.phone,
      email: pharmacy.email,
      address: pharmacy.address,
      isActive: pharmacy.isActive,
      createdAt: pharmacy.createdAt.toISOString(),
      subscription: pharmacy.subscription ? serializeSubscription(pharmacy.subscription) : null,
    };
  },

  async updateSubscription(pharmacyId: string, input: UpdateSubscriptionInput) {
    const existing = await prisma.subscription.findUnique({ where: { pharmacyId } });
    if (!existing) throw new NotFoundError("Subscription");

    const data: Record<string, string | number | Date> = {};
    if (input.status) data.status = input.status;
    if (input.plan) data.plan = input.plan;
    if (input.price !== undefined) data.price = input.price;
    if (input.renewsAt) data.renewsAt = new Date(input.renewsAt);

    if (input.extendMonths) {
      const base = existing.renewsAt > new Date() ? existing.renewsAt : new Date();
      const months = input.extendMonths;
      data.renewsAt = new Date(base.setMonth(base.getMonth() + months));
      data.status = input.status ?? "active";
    }

    const subscription = await prisma.subscription.update({
      where: { id: existing.id },
      data,
    });

    return serializeSubscription(subscription);
  },
};