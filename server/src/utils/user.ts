import type { User, Role, RolePermission, Branch, Pharmacy, Subscription } from "../generated/prisma/client";
import { resolveUserPermissions } from "../services/permissions";

export type UserSource = User & {
  roleRef?:
    | (Role & { permissions: Array<RolePermission & { permission: { name: string } }> })
    | null;
  branch?: Branch | null;
  pharmacy?: (Pharmacy & { subscription?: Subscription | null }) | null;
};

export interface PublicSubscription {
  status: string;
  plan: string;
  price: number;
  startedAt: string | null;
  renewsAt: string | null;
}

export interface PublicPharmacies {
  id: string;
  name: string;
  slug: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  subscription: PublicSubscription | null;
}

export interface PublicPharmacyProfile {
  id: string;
  name: string;
  slug: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  countryCode: string;
  countryName: string;
  city: string;
  currency: string;
  isEmailVerified: boolean;
  emailVerifiedAt: string | null;
  isPhoneVerified: boolean;
  phoneVerifiedAt: string | null;
  gracePeriod: {
    daysRemaining: number;
    isRestricted: boolean;
    isGracePeriodActive: boolean;
    isEmailVerified: boolean;
  };
}

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  roleId: string | null;
  roleName: string;
  branchId: string | null;
  branchName: string | null;
  jobRole: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacySlug: string;
  pharmacyProfile: PublicPharmacyProfile | null;
  subscription: PublicSubscription | null;
  permissions: string[];
  mustChangePassword: boolean;
  isActive: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const userWithRoleInclude = {
  roleRef: {
    include: { permissions: { include: { permission: true } } },
  },
  branch: true,
  pharmacy: {
    include: { subscription: true },
  },
} as const;

export function serializeUser(user: UserSource): PublicUser {
  const pharmacy = user.pharmacy ?? null;
  const subscription = pharmacy?.subscription ?? null;

  let pharmacyProfile: PublicPharmacyProfile | null = null;
  if (pharmacy) {
    const isEmailVerified = Boolean(pharmacy.isEmailVerified);
    const elapsedMs = Date.now() - (pharmacy.createdAt ? new Date(pharmacy.createdAt).getTime() : Date.now());
    const daysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const graceDaysTotal = 7;
    const daysRemaining = Math.max(0, graceDaysTotal - daysElapsed);
    const isGracePeriodActive = daysElapsed <= graceDaysTotal;
    const isRestricted = !isEmailVerified && !isGracePeriodActive;

    pharmacyProfile = {
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
    };
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    roleId: user.roleId,
    roleName: user.roleRef?.name ?? user.role,
    branchId: user.branchId,
    branchName: user.branch?.name ?? null,
    jobRole: user.jobRole ?? "",
    pharmacyId: pharmacy?.id ?? "",
    pharmacyName: pharmacy?.name ?? "",
    pharmacySlug: pharmacy?.slug ?? "",
    pharmacyProfile,
    subscription: subscription
      ? {
          status: subscription.status,
          plan: subscription.plan,
          price: subscription.price,
          startedAt: subscription.startedAt.toISOString() ?? null,
          renewsAt: subscription.renewsAt?.toISOString() ?? null,
        }
      : null,
    permissions: resolveUserPermissions(user),
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export { userWithRoleInclude };