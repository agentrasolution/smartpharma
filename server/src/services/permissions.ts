import type { User, RolePermission, Role } from "../generated/prisma/client";
import { LEGACY_ROLE_PERMISSIONS } from "../constants/permissions";

type UserWithRole = User & {
  roleRef?:
    | (Role & { permissions: Array<RolePermission & { permission: { name: string } }> })
    | null;
};

/**
 * Resolves the effective permission list for a user row.
 *
 * Users linked to a Role use the permissions assigned to that role via the
 * role_permissions join table. Legacy users without a roleId fall back to the
 * built-in role map so existing accounts keep working.
 */
export function resolveUserPermissions(user: UserWithRole): string[] {
  if (user.roleRef && user.roleRef.permissions.length > 0) {
    return user.roleRef.permissions.map((rp) => rp.permission.name);
  }
  if (user.roleRef) {
    return LEGACY_ROLE_PERMISSIONS[(user.role ?? "").toLowerCase()] ?? [];
  }
  return LEGACY_ROLE_PERMISSIONS[(user.role ?? "").toLowerCase()] ?? [];
}