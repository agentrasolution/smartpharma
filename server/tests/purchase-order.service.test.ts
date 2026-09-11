import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const existingOrder = {
    id: "po-existing",
    orderNumber: "PO-2609-000001",
    distributorId: "d1",
    companyId: null,
    status: "DRAFT",
    subtotal: 1530,
    total: 1530,
    notes: "",
    createdBy: "u1",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    idempotencyKey: "idemp-key-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [] as never[],
    distributor: { id: "d1", name: "Distributor A" },
  };

  const prismaMock = {
    purchaseOrder: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
    },
    distributor: {
      findUnique: vi.fn(async () => null),
    },
    product: {
      findMany: vi.fn(async () => []),
    },
    aIAuditLog: {
      create: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(async () => {
      throw new Error("$transaction should not run on idempotent replay");
    }),
  };

  return { prismaMock, existingOrder };
});

vi.mock("../src/services/prisma", () => ({ prisma: prismaMock }));

import { purchaseOrderService, roleHasPermission } from "../src/modules/purchase-orders/purchase-order.service";
import { UnauthorizedError } from "../src/utils/errors";

describe("purchase order idempotency (spec #93)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: idempotency key lookup finds nothing (fresh create path) or
    // the existing order when requested in specific tests.
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(null);
  });

  it("replays the same draft when the idempotency key already exists", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-existing",
      orderNumber: "PO-2609-000001",
      distributorId: "d1",
      companyId: null,
      status: "DRAFT",
      subtotal: 1530,
      total: 1530,
      notes: "",
      createdBy: "u1",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      idempotencyKey: "idemp-key-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      distributor: { id: "d1", name: "Distributor A" },
    });

    const result = await purchaseOrderService.createDraft(
      {
        distributorId: "d1",
        items: [{ productId: "p1", quantity: 1 }],
        idempotencyKey: "idemp-key-1",
      },
      { userId: "u1", role: "admin" },
    );

    expect(result.idempotencyKey).toBe("idemp-key-1");
    expect(result.orderNumber).toBe("PO-2609-000001");
    // A duplicate idempotency call must never create a second order.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.purchaseOrder.create).not.toHaveBeenCalled();
    expect(prismaMock.purchaseOrder.findFirst).not.toHaveBeenCalled();
  });

  it("rejects draft creation when the actor lacks CREATE_PURCHASE_DRAFT (spec #96)", async () => {
    expect(roleHasPermission("employee", "CREATE_PURCHASE_DRAFT")).toBe(false);
    await expect(
      purchaseOrderService.createDraft(
        { distributorId: "d1", items: [{ productId: "p1", quantity: 1 }] },
        { userId: "u1", role: "employee" },
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("returns structured error messages rather than fabricated success (spec #94)", async () => {
    await expect(
      purchaseOrderService.createDraft(
        { distributorId: "d1", items: [{ productId: "p1", quantity: 1 }] },
        { userId: "u1", role: "employee" },
      ),
    ).rejects.toThrowError("You do not have permission to create purchase orders");
  });

  it("throws NotFound when distributor does not exist", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(null);
    prismaMock.distributor.findUnique.mockResolvedValue(null);
    await expect(
      purchaseOrderService.createDraft(
        { distributorId: "missing", items: [{ productId: "p1", quantity: 1 }] },
        { userId: "u1", role: "admin" },
      ),
    ).rejects.toThrow("Distributor not found");
  });
});

describe("purchase order lifecycle guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submit is only allowed from DRAFT", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-advanced",
      orderNumber: "PO-2609-000002",
      distributorId: "d1",
      companyId: null,
      status: "PENDING_APPROVAL",
      subtotal: 0,
      total: 0,
      notes: "",
      createdBy: "u1",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      idempotencyKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      distributor: { id: "d1", name: "Distributor A" },
    });

    await expect(
      purchaseOrderService.submitForApproval("po-advanced", { userId: "u1", role: "admin" }),
    ).rejects.toThrow(/Only DRAFT/);
  });

  it("approve records an audit log entry with actor details (spec #65)", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-pending",
      orderNumber: "PO-2609-000010",
      distributorId: "d1",
      companyId: null,
      status: "PENDING_APPROVAL",
      subtotal: 100,
      total: 100,
      notes: "",
      createdBy: "u2",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      idempotencyKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    const approvedOrder = {
      id: "po-pending",
      orderNumber: "PO-2609-000010",
      distributorId: "d1",
      companyId: null,
      status: "APPROVED",
      subtotal: 100,
      total: 100,
      notes: "",
      createdBy: "u2",
      approvedBy: "u1",
      approvedAt: new Date(),
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      idempotencyKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      distributor: { id: "d1", name: "Distributor A" },
    };

    prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
      fn(prismaMock));
    prismaMock.purchaseOrder.update.mockResolvedValue(approvedOrder);

    const result = await purchaseOrderService.approve("po-pending", { userId: "u1", role: "manager" });

    expect(result.status).toBe("APPROVED");
    const logged = prismaMock.aIAuditLog.create.mock.calls[0][0];
    expect(logged.data.action).toBe("purchase_order.approved");
    expect(logged.data.approvalRequired).toBe(true);
    expect(logged.data.approvalStatus).toBe("APPROVED");
    expect(logged.data.approvedBy).toBe("u1");
    expect(logged.data.status).toBe("SUCCESS");
  });

  it("reject records an audit log entry with the reason (spec #65)", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-draft",
      orderNumber: "PO-2609-000011",
      distributorId: "d1",
      companyId: null,
      status: "DRAFT",
      subtotal: 100,
      total: 100,
      notes: "",
      createdBy: "u2",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      idempotencyKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    const rejectedOrder = {
      id: "po-draft",
      orderNumber: "PO-2609-000011",
      distributorId: "d1",
      companyId: null,
      status: "REJECTED",
      subtotal: 100,
      total: 100,
      notes: "",
      createdBy: "u2",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: "u1",
      rejectedAt: new Date(),
      rejectionReason: "Too many units",
      idempotencyKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      distributor: { id: "d1", name: "Distributor A" },
    };

    prismaMock.purchaseOrder.update.mockResolvedValue(rejectedOrder);

    const result = await purchaseOrderService.reject("po-draft", { userId: "u1", role: "admin" }, "Too many units");

    expect(result.status).toBe("REJECTED");
    const logged = prismaMock.aIAuditLog.create.mock.calls[0][0];
    expect(logged.data.action).toBe("purchase_order.rejected");
    expect(logged.data.approvalRequired).toBe(true);
    expect(logged.data.approvalStatus).toBe("REJECTED");
    expect(logged.data.approvedBy).toBe("u1");
    expect(logged.data.inputJson).toEqual(expect.objectContaining({ reason: "Too many units" }));
    expect(logged.data.status).toBe("SUCCESS");
  });
});