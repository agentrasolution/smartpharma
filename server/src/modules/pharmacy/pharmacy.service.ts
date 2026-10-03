import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import type { UpdatePharmacyInput, UpdateSubscriptionInput, OnboardingInput } from "./pharmacy.schema";

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

    const isEmailVerified = Boolean(pharmacy.isEmailVerified);
    const elapsedMs = Date.now() - (pharmacy.createdAt ? new Date(pharmacy.createdAt).getTime() : Date.now());
    const daysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const graceDaysTotal = 7;
    const daysRemaining = Math.max(0, graceDaysTotal - daysElapsed);
    const isGracePeriodActive = daysElapsed <= graceDaysTotal;
    const isRestricted = !isEmailVerified && !isGracePeriodActive;

    return {
      id: pharmacy.id,
      name: pharmacy.name,
      slug: pharmacy.slug,
      contact: pharmacy.contact,
      phone: pharmacy.phone,
      email: pharmacy.email,
      address: pharmacy.address,
      countryCode: pharmacy.countryCode || "",
      countryName: pharmacy.countryName || "",
      city: pharmacy.city || "",
      currency: pharmacy.currency || "SAR",
      timezone: pharmacy.timezone || "UTC",
      isEmailVerified,
      emailVerifiedAt: pharmacy.emailVerifiedAt?.toISOString() ?? null,
      isPhoneVerified: Boolean(pharmacy.isPhoneVerified),
      phoneVerifiedAt: pharmacy.phoneVerifiedAt?.toISOString() ?? null,
      gracePeriod: {
        daysRemaining,
        isRestricted,
        isGracePeriodActive,
        isEmailVerified,
      },
      isActive: pharmacy.isActive,
      createdAt: pharmacy.createdAt.toISOString(),
      counts: pharmacy._count,
      subscription: pharmacy.subscription ? serializeSubscription(pharmacy.subscription) : null,
    };
  },

  async updateOwn(pharmacyId: string, input: UpdatePharmacyInput) {
    const data: Record<string, any> = {};
    for (const key of [
      "name",
      "contact",
      "phone",
      "email",
      "address",
      "countryCode",
      "countryName",
      "city",
      "currency",
      "timezone",
    ] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }

    if (input.isPhoneVerified !== undefined) {
      data.isPhoneVerified = input.isPhoneVerified;
      data.phoneVerifiedAt = input.isPhoneVerified ? new Date() : null;
    }

    if (data.name) {
      const clash = await prisma.pharmacy.findFirst({
        where: { name: data.name, id: { not: pharmacyId } },
      });
      if (clash) throw new BadRequestError("Another pharmacy already uses this name");
    }

    // If email is explicitly updated to a new value, reset verification
    const existing = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (data.email && existing && data.email.toLowerCase() !== existing.email.toLowerCase()) {
      data.isEmailVerified = false;
      data.emailVerifiedAt = null;
    }

    const pharmacy = await prisma.pharmacy.update({
      where: { id: pharmacyId },
      data,
      include: { subscription: true, _count: { select: { branches: true, users: true, products: true } } },
    });

    const isEmailVerified = Boolean(pharmacy.isEmailVerified);
    const elapsedMs = Date.now() - (pharmacy.createdAt ? new Date(pharmacy.createdAt).getTime() : Date.now());
    const daysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const graceDaysTotal = 7;
    const daysRemaining = Math.max(0, graceDaysTotal - daysElapsed);
    const isGracePeriodActive = daysElapsed <= graceDaysTotal;
    const isRestricted = !isEmailVerified && !isGracePeriodActive;

    return {
      id: pharmacy.id,
      name: pharmacy.name,
      slug: pharmacy.slug,
      contact: pharmacy.contact,
      phone: pharmacy.phone,
      email: pharmacy.email,
      address: pharmacy.address,
      countryCode: pharmacy.countryCode || "",
      countryName: pharmacy.countryName || "",
      city: pharmacy.city || "",
      currency: pharmacy.currency || "SAR",
      timezone: pharmacy.timezone || "UTC",
      isEmailVerified,
      emailVerifiedAt: pharmacy.emailVerifiedAt?.toISOString() ?? null,
      isPhoneVerified: Boolean(pharmacy.isPhoneVerified),
      phoneVerifiedAt: pharmacy.phoneVerifiedAt?.toISOString() ?? null,
      gracePeriod: {
        daysRemaining,
        isRestricted,
        isGracePeriodActive,
        isEmailVerified,
      },
      isActive: pharmacy.isActive,
      createdAt: pharmacy.createdAt.toISOString(),
      counts: pharmacy._count,
      subscription: pharmacy.subscription ? serializeSubscription(pharmacy.subscription) : null,
    };
  },

  async onboard(pharmacyId: string, input: OnboardingInput) {
    const baseSlug = input.pharmacyName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "pharmacy";

    // Check name uniqueness (excluding self)
    const clash = await prisma.pharmacy.findFirst({
      where: { name: input.pharmacyName.trim(), id: { not: pharmacyId } },
    });
    if (clash) throw new BadRequestError("Another pharmacy already uses this name");

    let slug = baseSlug;
    const slugClash = await prisma.pharmacy.findFirst({
      where: { slug, id: { not: pharmacyId } },
    });
    if (slugClash) {
      slug = `${baseSlug}-${pharmacyId.slice(0, 6)}`;
    }

    // Update pharmacy + first branch in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.pharmacy.update({
        where: { id: pharmacyId },
        data: {
          name: input.pharmacyName.trim(),
          slug,
          phone: input.phone?.trim() ?? "",
          countryCode: input.country?.trim() ?? "",
          countryName: input.countryName?.trim() ?? "",
          city: input.city?.trim() ?? "",
          currency: input.currency?.trim() ?? "SAR",
          address: [input.city?.trim(), input.countryName || input.country].filter(Boolean).join(", "),
          contact: input.licenceNumber?.trim() ?? "",
        },
      });

      // Update first branch
      const branch = await tx.branch.findFirst({ where: { pharmacyId }, orderBy: { createdAt: "asc" } });
      if (branch) {
        await tx.branch.update({
          where: { id: branch.id },
          data: {
            name: input.branchName.trim(),
            address: input.branchAddress?.trim() ?? "",
            phone: input.phone?.trim() ?? "",
          },
        });
      }
    });

    return { success: true };
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