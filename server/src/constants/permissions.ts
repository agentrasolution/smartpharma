export interface PermissionDefinition {
  name: string;
  description: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  { name: "dashboard.view", description: "View the dashboard" },
  { name: "products.view", description: "View products" },
  { name: "products.create", description: "Create products" },
  { name: "products.update", description: "Update products" },
  { name: "products.delete", description: "Delete products" },
  { name: "stock.view", description: "View stock and purchases" },
  { name: "stock.create", description: "Record stock purchases" },
  { name: "stock.update", description: "Update stock purchases" },
  { name: "sales.view", description: "View sales and invoices" },
  { name: "sales.create", description: "Create sales" },
  { name: "sales.update", description: "Update sales" },
  { name: "sales.delete", description: "Delete sales" },
  { name: "sales.discount", description: "Apply discounts to sales" },
  { name: "returns.view", description: "View returns" },
  { name: "returns.create", description: "Create returns" },
  { name: "customers.view", description: "View customers" },
  { name: "customers.create", description: "Create customers" },
  { name: "customers.update", description: "Update customers" },
  { name: "customers.delete", description: "Delete customers" },
  { name: "distributors.view", description: "View distributors" },
  { name: "distributors.create", description: "Create distributors" },
  { name: "distributors.update", description: "Update distributors" },
  { name: "expenses.view", description: "View expenses" },
  { name: "expenses.create", description: "Create expenses" },
  { name: "expenses.update", description: "Update expenses" },
  { name: "expenses.delete", description: "Delete expenses" },
  { name: "reports.view", description: "View reports" },
  { name: "reports.export", description: "Export reports" },
  { name: "users.view", description: "View users" },
  { name: "users.create", description: "Create users" },
  { name: "users.update", description: "Update users" },
  { name: "users.delete", description: "Delete or deactivate users" },
  { name: "users.reset_password", description: "Reset user passwords" },
  { name: "branches.view", description: "View branches" },
  { name: "branches.create", description: "Create branches" },
  { name: "branches.update", description: "Update branches" },
  { name: "branches.delete", description: "Delete branches" },
  { name: "settings.view", description: "View settings" },
  { name: "settings.update", description: "Update settings" },
  { name: "pharmacy.view", description: "View pharmacy details and branch list" },
  { name: "pharmacy.update", description: "Update pharmacy profile and branding" },
  { name: "subscription.view", description: "View the pharmacy subscription and billing status" },
  { name: "billing.manage", description: "Manage pharmacy subscriptions and plans (platform)" },
];

export const ALL_PERMISSION_NAMES: string[] = PERMISSIONS.map((p) => p.name);

// A tenant super-admin gets every capability except platform billing management.
export const TENANT_PERMISSION_NAMES: string[] = ALL_PERMISSION_NAMES.filter(
  (p) => p !== "billing.manage",
);

const MANAGER_PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "products.create",
  "products.update",
  "stock.view",
  "stock.create",
  "stock.update",
  "sales.view",
  "sales.create",
  "sales.update",
  "sales.delete",
  "sales.discount",
  "returns.view",
  "returns.create",
  "customers.view",
  "customers.create",
  "customers.update",
  "customers.delete",
  "distributors.view",
  "distributors.create",
  "distributors.update",
  "expenses.view",
  "expenses.create",
  "expenses.update",
  "expenses.delete",
  "reports.view",
  "reports.export",
  "users.view",
  "branches.view",
  "settings.view",
];

const CASHIER_PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "stock.view",
  "sales.view",
  "sales.create",
  "sales.update",
  "sales.discount",
  "returns.view",
  "returns.create",
  "customers.view",
  "customers.create",
  "customers.update",
];

const STOCK_MANAGER_PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "products.create",
  "products.update",
  "stock.view",
  "stock.create",
  "stock.update",
  "distributors.view",
  "distributors.create",
  "distributors.update",
  "returns.view",
  "customers.view",
  "expenses.view",
  "reports.view",
];

const SUPER_ADMIN_PERMISSIONS = [...TENANT_PERMISSION_NAMES];

export const DEFAULT_ROLES: Array<{ name: string; description: string; permissions: string[] }> = [
  { name: "Admin", description: "Full access to every module", permissions: SUPER_ADMIN_PERMISSIONS },
  { name: "Manager", description: "Manages day-to-day pharmacy operations", permissions: MANAGER_PERMISSIONS },
  { name: "Cashier", description: "Handles point-of-sale billing and customers", permissions: CASHIER_PERMISSIONS },
  { name: "Stock Manager", description: "Manages products, stock and distributors", permissions: STOCK_MANAGER_PERMISSIONS },
];

// Fallback permission map for legacy users that do not yet have a roleId.
// Keeps existing admin working while remaining strict for unknown roles.
export const LEGACY_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: TENANT_PERMISSION_NAMES,
  manager: MANAGER_PERMISSIONS,
  cashier: CASHIER_PERMISSIONS,
  "stock manager": STOCK_MANAGER_PERMISSIONS,
};