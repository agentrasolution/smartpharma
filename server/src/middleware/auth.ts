import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../services/prisma";
import { config } from "../config/env";
import { ForbiddenError, PaymentRequiredError, UnauthorizedError } from "../utils/errors";
import { resolveUserPermissions } from "../services/permissions";
import { userWithRoleInclude } from "../utils/user";

export interface AuthPayload {
  userId: string;
  username: string;
  role: string;
}

export interface AuthUserSubscription {
  status: string;
  plan: string;
  price: number;
  renewsAt: string | null;
}

export interface AuthUser {
  userId: string;
  username: string;
  role: string;
  roleId: string | null;
  roleName: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  jobRole: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacySlug: string;
  subscription: AuthUserSubscription | null;
  permissions: string[];
  mustChangePassword: boolean;
  isActive: boolean;
}

const SUBSCRIPTION_ALLOWED = new Set(["trial", "active"]);

/**
 * Resolves the effective subscription status. "cancelled" is always blocked and
 * any plan whose renewal date has passed is treated as expired.
 */
export function effectiveSubscriptionStatus(
  sub: { status: string; renewsAt: Date | string | null } | null,
): string | null {
  if (!sub) return "none";
  if (sub.status === "cancelled") return "cancelled";
  if (sub.renewsAt) {
    const renewsAt = typeof sub.renewsAt === "string" ? new Date(sub.renewsAt) : sub.renewsAt;
    if (renewsAt.getTime() < Date.now() && SUBSCRIPTION_ALLOWED.has(sub.status)) {
      return "expired";
    }
  }
  return sub.status;
}

/**
 * Lazy-expire subscriptions whose renewal date has passed so the DB reflects
 * what the middleware enforces. Runs only when there is something to expire.
 */
export async function expireStaleSubscriptions(): Promise<void> {
  await prisma.subscription.updateMany({
    where: {
      renewsAt: { lt: new Date() },
      status: { in: ["trial", "active", "past_due"] },
    },
    data: { status: "expired" },
  });
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid token");
    }

    const token = header.slice(7);
    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: userWithRoleInclude,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const permissions = resolveUserPermissions(user);

    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
      roleId: user.roleId,
      roleName: user.roleRef?.name ?? user.role,
      name: user.name,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      jobRole: user.jobRole ?? "",
      pharmacyId: user.pharmacy?.id ?? "",
      pharmacyName: user.pharmacy?.name ?? "",
      pharmacySlug: user.pharmacy?.slug ?? "",
      subscription: user.pharmacy?.subscription
        ? {
            status: user.pharmacy.subscription.status,
            plan: user.pharmacy.subscription.plan,
            price: user.pharmacy.subscription.price,
            renewsAt: user.pharmacy.subscription.renewsAt.toISOString(),
          }
        : null,
      permissions,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * RBAC middleware. Requires `authenticate` to run first and rejects with 403
 * when the authenticated user lacks every required permission.
 */
export function authorize(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }
    const allowed = user.permissions.some((p) => required.includes(p));
    if (!allowed) {
      throw new ForbiddenError();
    }
    next();
  };
}

/**
 * Blocks every non-auth route for pharmacies whose subscription is not
 * trial/active. Must run after `authenticate`.
 */
export async function requireActiveSubscription(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    await expireStaleSubscriptions();
    const user = req.user as AuthUser | undefined;
    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }
    const status = effectiveSubscriptionStatus(
      user.subscription
        ? {
            status: user.subscription.status,
            renewsAt: user.subscription.renewsAt ? new Date(user.subscription.renewsAt) : null,
          }
        : null,
    );
    if (!status || !SUBSCRIPTION_ALLOWED.has(status)) {
      throw new PaymentRequiredError(
        "Your pharmacy subscription is inactive or has expired. Renew your plan to continue.",
        "SUBSCRIPTION_REQUIRED",
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

export interface BranchScope {
  pharmacyId: string;
  branchId?: string;
}

/**
 * Resolves the tenant scope for the current request.
 *
 * - A user assigned to a branch (salesman/cashier/manager) is always locked to
 *   that branch - their data can never cross branch boundaries.
 * - A cross-branch admin (no branch) sees the whole pharmacy; they may narrow
 *   the scope with `?branchId=` when provided.
 */
export function branchScope(
  req: Request,
  opts: { branchParam?: boolean; branchParamRequired?: boolean } = {},
): BranchScope {
  const user = req.user as AuthUser;
  const pharmacyId = user.pharmacyId;

  if (user.branchId) {
    return { pharmacyId, branchId: user.branchId };
  }

  const requested = opts.branchParam ? String(req.query.branchId ?? "") : "";
  if (requested) {
    return { pharmacyId, branchId: requested };
  }
  return { pharmacyId };
}

/**
 * A convenience helper that turns the request scope into a Prisma `where`
 * object for any pharmacy-scoped model.
 */
export function scopeWhere(
  req: Request,
  opts: { branchParam?: boolean } = {},
): { pharmacyId: string; branchId?: string } {
  return branchScope(req, opts);
}