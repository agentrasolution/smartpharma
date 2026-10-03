import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const mock: any = {
    supplierReturn: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    distributor: {
      findFirst: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    batch: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    purchaseInvoice: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    distributorPayment: {
      create: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
  };
  mock.$transaction = vi.fn((cb: any) => cb(mock));
  return { prismaMock: mock };
});

vi.mock("../src/services/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/socket", () => ({
  emitEvent: vi.fn(),
}));

const prisma = prismaMock;
import { supplierReturnsService } from "../src/modules/purchases/supplier-returns.service";

describe("SupplierReturnsService", () => {
  const scope = { pharmacyId: "pharm-1", branchId: "branch-1" };
  const user = { id: "user-1", name: "Dr. Ahmed", username: "ahmed" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists supplier returns with pagination", async () => {
    (prisma.supplierReturn.count as any).mockResolvedValue(1);
    (prisma.supplierReturn.findMany as any).mockResolvedValue([
      {
        id: "rtv-1",
        returnNumber: "RTV-202610-0001",
        totalAmount: 1500,
        status: "PENDING",
        distributor: { id: "dist-1", name: "Al-Dawaa Pharma" },
        branch: { id: "branch-1", name: "Main Branch" },
        items: [],
      },
    ]);

    const res = await supplierReturnsService.list(scope, { page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(res.data[0].returnNumber).toBe("RTV-202610-0001");
    expect(res.data[0].totalAmount).toBe(1500);
  });

  it("finds near-expiry and recalled candidates for return", async () => {
    const nearExp = new Date();
    nearExp.setDate(nearExp.getDate() + 30);

    (prisma.batch.findMany as any).mockResolvedValue([
      {
        id: "batch-1",
        batchNumber: "B123",
        expiryDate: nearExp,
        quantity: 50,
        costPrice: 20,
        isRecalled: false,
        productId: "prod-1",
        product: {
          id: "prod-1",
          name: "Amoxicillin 500mg",
          barcode: "12345678",
          category: "Antibiotics",
          distributorId: "dist-1",
          pack_size: 10,
          distributor: { id: "dist-1", name: "Al-Dawaa Pharma" },
        },
      },
    ]);

    const candidates = await supplierReturnsService.getCandidates(scope, "dist-1", 60);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].batchNumber).toBe("B123");
    expect(candidates[0].suggestedReason).toBe("NEAR_EXPIRY");
    expect(candidates[0].quantityAvailable).toBe(50);
  });

  it("creates a supplier return in pending status", async () => {
    (prisma.distributor.findFirst as any).mockResolvedValue({ id: "dist-1", name: "Al-Dawaa" });
    (prisma.supplierReturn.findFirst as any).mockResolvedValue(null);
    (prisma.product.findFirst as any).mockResolvedValue({
      id: "prod-1",
      name: "Amoxicillin",
      pack_size: 10,
      stock_qty: 100,
    });
    (prisma.batch.findFirst as any).mockResolvedValue({
      id: "batch-1",
      batchNumber: "B123",
      quantity: 50,
    });

    const mockCreated = {
      id: "rtv-new",
      pharmacyId: "pharm-1",
      branchId: "branch-1",
      distributorId: "dist-1",
      returnNumber: "RTV-202610-0001",
      status: "PENDING",
      totalAmount: 200,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          batchNumber: "B123",
          quantityPacks: 10,
          unitCost: 20,
          totalCost: 200,
        },
      ],
      distributor: { id: "dist-1", name: "Al-Dawaa" },
      branch: { id: "branch-1", name: "Main Branch" },
    };

    (prisma.supplierReturn.create as any).mockResolvedValue(mockCreated);

    const result = await supplierReturnsService.create(scope, user, {
      distributorId: "dist-1",
      reason: "NEAR_EXPIRY",
      items: [
        {
          productId: "prod-1",
          batchNumber: "B123",
          quantityPacks: 10,
          unitsPerPack: 1,
          unitCost: 20,
        },
      ],
    });

    expect(result.returnNumber).toBe("RTV-202610-0001");
    expect(result.status).toBe("PENDING");
    expect(result.totalAmount).toBe(200);
  });

  it("approves return: deducts batch quantity, logs stock movement, and creates supplier credit note", async () => {
    const existingReturn = {
      id: "rtv-1",
      pharmacyId: "pharm-1",
      branchId: "branch-1",
      distributorId: "dist-1",
      returnNumber: "RTV-202610-0001",
      status: "PENDING",
      totalAmount: 500,
      invoiceId: "inv-1",
      reason: "DAMAGED",
      notes: "Boxes damaged during storm",
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          batchId: "batch-1",
          batchNumber: "B123",
          quantityBaseUnits: 25,
          unitCost: 20,
          totalCost: 500,
          reason: "DAMAGED",
        },
      ],
    };

    (prisma.supplierReturn.findFirst as any).mockResolvedValue(existingReturn);
    (prisma.batch.findUnique as any).mockResolvedValue({ id: "batch-1", quantity: 50 });
    (prisma.batch.update as any).mockResolvedValue({ id: "batch-1", quantity: 25 });
    (prisma.product.findUnique as any).mockResolvedValue({ id: "prod-1", stock_qty: 100 });
    (prisma.product.update as any).mockResolvedValue({ id: "prod-1", stock_qty: 75 });
    (prisma.stockMovement.create as any).mockResolvedValue({ id: "sm-1" });
    (prisma.purchaseInvoice.findUnique as any).mockResolvedValue({
      id: "inv-1",
      balanceDue: 1500,
      status: "PARTIAL",
    });
    (prisma.purchaseInvoice.update as any).mockResolvedValue({
      id: "inv-1",
      balanceDue: 1000,
      status: "PARTIAL",
    });
    (prisma.distributorPayment.create as any).mockResolvedValue({ id: "pay-credit-1" });

    (prisma.supplierReturn.update as any).mockResolvedValue({
      ...existingReturn,
      status: "APPROVED",
      creditNoteNumber: "CN-ALDAWAA-998",
      approvedById: "user-1",
      approvedByName: "Dr. Ahmed",
      distributor: { id: "dist-1", name: "Al-Dawaa" },
      branch: { id: "branch-1", name: "Main Branch" },
    });

    const approved = await supplierReturnsService.approve(scope, user, "rtv-1", {
      creditNoteNumber: "CN-ALDAWAA-998",
      notes: "Distributor approved full credit",
    });

    expect(approved.status).toBe("APPROVED");
    expect(approved.creditNoteNumber).toBe("CN-ALDAWAA-998");

    // Verify stock deduction
    expect(prisma.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-1" },
        data: { quantity: 25 },
      }),
    );
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data: { stock_qty: 75 },
      }),
    );

    // Verify stock movement
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: "SUPPLIER_RETURN",
          quantityDelta: -25,
          referenceNumber: "RTV-202610-0001",
        }),
      }),
    );

    // Verify invoice reconciliation
    expect(prisma.purchaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: { balanceDue: 1000, status: "PARTIAL" },
      }),
    );

    // Verify credit note creation in distributor ledger
    expect(prisma.distributorPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: "CREDIT_NOTE",
          amount: 500,
          distributorId: "dist-1",
          referenceNumber: "CN-ALDAWAA-998",
        }),
      }),
    );
  });
});
