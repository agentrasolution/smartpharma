import { describe, expect, it } from "vitest";
import { checkPermission, getPermissionsForRole, PERMISSIONS, roleCanApprove } from "../src/ai/permissions/permissions";
import { UnauthorizedError } from "../src/utils/errors";
import { inventoryTools } from "../src/ai/tools/inventory.tools";
import { ToolRegistry } from "../src/ai/tools/tool.registry";

// Spec #92: AI must never be able to approve or reject purchase orders.
describe("AI approval safety (spec #92 / #96)", () => {
  it("the AI tool set exposes NO approve/reject tools", () => {
    const names = inventoryTools.map((t) => t.name);
    expect(names).not.toContain("approve_purchase_order");
    expect(names).not.toContain("reject_purchase_order");
    expect(names).not.toContain("approve");
    expect(names).not.toContain("reject");
  });

  it("the registry contains only the 16 documented safe tools", () => {
    const registry = new ToolRegistry(inventoryTools);
    const names = registry.list().map((t) => t.name).sort();
    expect(names).toEqual([
      "analyze_product_inventory",
      "create_purchase_order_draft",
      "get_data_quality",
      "get_distributor",
      "get_expiry_analysis",
      "get_inventory_products",
      "get_inventory_summary",
      "get_overstock_products",
      "get_product_inventory",
      "get_purchase_history",
      "get_reorder_candidates",
      "get_sales_history",
      "get_slow_moving_products",
      "get_today_sales_summary",
      "submit_purchase_order_for_approval",
    ].sort());
  });

  it("create_purchase_order_draft is flagged requiresApproval", () => {
    const tool = inventoryTools.find((t) => t.name === "create_purchase_order_draft");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("submit tool only moves to PENDING_APPROVAL, never APPROVED", () => {
    const tool = inventoryTools.find((t) => t.name === "submit_purchase_order_for_approval");
    expect(tool?.description.toLowerCase()).toContain("pending_approval");
    expect(tool?.description.toLowerCase()).not.toContain("approves");
  });
});

// Role permission matrix (spec #46).
describe("role permission matrix (spec #96)", () => {
  it("admin can approve and reject", () => {
    expect(roleCanApprove("admin")).toBe(true);
    expect(checkPermission("admin", PERMISSIONS.APPROVE_PURCHASE)).toBeUndefined();
  });

  it("manager can approve and reject", () => {
    expect(roleCanApprove("manager")).toBe(true);
  });

  it("pharmacist can create drafts but cannot approve", () => {
    expect(checkPermission("pharmacist", PERMISSIONS.CREATE_PURCHASE_DRAFT)).toBeUndefined();
    expect(() => checkPermission("pharmacist", PERMISSIONS.APPROVE_PURCHASE)).toThrowError(UnauthorizedError);
    expect(roleCanApprove("pharmacist")).toBe(false);
  });

  it("employee cannot create, submit, approve or reject", () => {
    expect(() => checkPermission("employee", PERMISSIONS.CREATE_PURCHASE_DRAFT)).toThrowError(UnauthorizedError);
    expect(() => checkPermission("employee", PERMISSIONS.SUBMIT_PURCHASE)).toThrowError(UnauthorizedError);
    expect(() => checkPermission("employee", PERMISSIONS.APPROVE_PURCHASE)).toThrowError(UnauthorizedError);
    expect(() => checkPermission("employee", PERMISSIONS.REJECT_PURCHASE)).toThrowError(UnauthorizedError);
    expect(roleCanApprove("employee")).toBe(false);
  });

  it("unknown roles get only read + analyze", () => {
    const perms = getPermissionsForRole("stranger");
    expect(perms).toEqual(["READ_INVENTORY", "ANALYZE_INVENTORY"]);
  });
});

// Spec #94: an unknown tool must yield a structured error, never fabricated data.
describe("tool error handling (spec #94)", () => {
  it("unknown tool returns TOOL_NOT_FOUND with no data", async () => {
    const registry = new ToolRegistry(inventoryTools);
    const res = await registry.execute(
      "definitely_not_a_tool",
      { userId: "u", role: "admin" },
      {},
    );
    expect(res.success).toBe(false);
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe("TOOL_NOT_FOUND");
  });

  it("permission-gated tool denies employee before touching the database", async () => {
    const registry = new ToolRegistry(inventoryTools);
    const res = await registry.execute(
      "create_purchase_order_draft",
      { userId: "u", role: "employee" },
      { distributorId: "x", items: [{ productId: "p", quantity: 1 }] },
    );
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe("PERMISSION_DENIED");
  });
});