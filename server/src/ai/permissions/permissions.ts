import { roleHasPermission, ROLE_PERMISSIONS } from "../../modules/purchase-orders/purchase-order.service";
import { UnauthorizedError } from "../../utils/errors";

// UI-facing permission metadata used to drive the permission matrix.
export const PERMISSIONS = {
  READ_INVENTORY: "READ_INVENTORY",
  ANALYZE_INVENTORY: "ANALYZE_INVENTORY",
  CREATE_PURCHASE_DRAFT: "CREATE_PURCHASE_DRAFT",
  SUBMIT_PURCHASE: "SUBMIT_PURCHASE",
  APPROVE_PURCHASE: "APPROVE_PURCHASE",
  REJECT_PURCHASE: "REJECT_PURCHASE",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function checkPermission(role: string, permission: string): void {
  if (!roleHasPermission(role, permission)) {
    throw new UnauthorizedError(`Missing required permission: ${permission}`);
  }
}

export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? ["READ_INVENTORY", "ANALYZE_INVENTORY"];
}

// The AI agent itself is human-constrained. Human role is the gate.
export const roleCanApprove = (role: string): boolean =>
  roleHasPermission(role, PERMISSIONS.APPROVE_PURCHASE) || roleHasPermission(role, PERMISSIONS.REJECT_PURCHASE);