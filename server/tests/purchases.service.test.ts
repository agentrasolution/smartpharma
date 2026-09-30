import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    branch: {
      findFirst: vi.fn(),
    },
    distributor: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    purchaseInvoice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    purchaseInvoiceItem: {
      create: vi.fn(),
    },
    distributorPayment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    batch: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
    stockPurchase: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(prismaMock)),
  };
  return { prismaMock };
});

vi.mock("../src/services/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/socket", () => ({ emitEvent: vi.fn() }));

import { purchasesService } from "../src/modules/purchases/purchases.service";

describe("purchasesService (Pillar D: Purchasing & Direct Supplier Invoices)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a direct supplier invoice with batch provisioning and stock receipt", async () => {
    const scope = { pharmacyId: "ph1", branchId: "b1" };

    prismaMock.distributor.findFirst.mockResolvedValueOnce({
      id: "dist-1",
      name: "Global Pharma Distributors",
      pharmacyId: "ph1",
      companyId: "comp-1",
    });

    prismaMock.purchaseInvoice.findUnique.mockResolvedValueOnce(null);

    prismaMock.product.findFirst.mockResolvedValueOnce({
      id: "prod-1",
      name: "Amoxicillin 500mg",
      unitsPerPack: 20,
    });

    prismaMock.purchaseInvoice.create.mockResolvedValueOnce({
      id: "inv-1",
      pharmacyId: "ph1",
      branchId: "b1",
      distributorId: "dist-1",
      invoiceNumber: "INV-2026-001",
      subtotal: 500,
      discount: 0,
      tax: 0,
      totalAmount: 500,
      paidAmount: 200,
      balanceDue: 300,
      status: "PARTIAL",
    });

    prismaMock.batch.findFirst.mockResolvedValueOnce(null);
    prismaMock.batch.create.mockResolvedValueOnce({
      id: "batch-1",
      batchNumber: "LOT-A100",
      quantityInBaseUnits: 200,
    });
    prismaMock.batch.aggregate.mockResolvedValueOnce({
      _sum: { quantityInBaseUnits: 200 },
    });

    prismaMock.stockMovement.create.mockResolvedValueOnce({ id: "mov-1" });
    prismaMock.purchaseInvoiceItem.create.mockResolvedValueOnce({ id: "item-1" });
    prismaMock.product.update.mockResolvedValueOnce({ id: "prod-1" });
    prismaMock.stockPurchase.create.mockResolvedValueOnce({ id: "sp-1" });
    prismaMock.distributorPayment.create.mockResolvedValueOnce({ id: "pay-1" });

    prismaMock.purchaseInvoice.findUnique.mockResolvedValueOnce({
      id: "inv-1",
      pharmacyId: "ph1",
      branchId: "b1",
      distributorId: "dist-1",
      invoiceNumber: "INV-2026-001",
      invoiceDate: new Date(),
      subtotal: 500,
      discount: 0,
      tax: 0,
      totalAmount: 500,
      paidAmount: 200,
      balanceDue: 300,
      status: "PARTIAL",
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          batchNumber: "LOT-A100",
          expiryDate: new Date("2028-05-01"),
          quantityPacks: 10,
          unitsPerPack: 20,
          quantityBaseUnits: 200,
          unitCost: 50,
          salePrice: 65,
          totalCost: 500,
          product: { name: "Amoxicillin 500mg" },
        },
      ],
      payments: [
        { id: "pay-1", amount: 200, paymentMethod: "CASH", paidAt: new Date() },
      ],
      distributor: { id: "dist-1", name: "Global Pharma Distributors" },
    });

    const result = await purchasesService.createInvoice(scope, {
      distributorId: "dist-1",
      invoiceNumber: "INV-2026-001",
      invoiceDate: "2026-09-30",
      paidAmount: 200,
      paymentMethod: "CASH",
      notes: "Received delivery in good condition",
      items: [
        {
          productId: "prod-1",
          batchNumber: "LOT-A100",
          expiryDate: "2028-05-01",
          quantityPacks: 10,
          unitsPerPack: 20,
          unitCost: 50,
          salePrice: 65,
        },
      ],
    });

    expect(result).toBeDefined();
    expect(result.invoiceNumber).toBe("INV-2026-001");
    expect(result.totalAmount).toBe(500);
    expect(result.paidAmount).toBe(200);
    expect(result.balanceDue).toBe(300);
    expect(result.status).toBe("PARTIAL");

    // Verify batch was created with correct base units (10 packs * 20 units/pack = 200)
    expect(prismaMock.batch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          batchNumber: "LOT-A100",
          quantityInBaseUnits: 200,
          costPricePerUnit: 2.5, // 50 / 20
        }),
      })
    );

    // Verify stock movement was logged as PURCHASE_RECEIPT
    expect(prismaMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: "PURCHASE_RECEIPT",
          quantityDelta: 200,
          referenceNumber: "INV-2026-001",
        }),
      })
    );

    // Verify upfront payment was created
    expect(prismaMock.distributorPayment.create).toHaveBeenCalled();
  });

  it("calculates running statement and Accounts Payable balance in getDistributorLedger", async () => {
    const scope = { pharmacyId: "ph1", branchId: "b1" };

    prismaMock.distributor.findFirst.mockResolvedValueOnce({
      id: "dist-1",
      name: "Global Pharma Distributors",
      company: { name: "Global Pharma Corp" },
    });

    prismaMock.purchaseInvoice.findMany.mockResolvedValueOnce([
      {
        id: "inv-1",
        invoiceNumber: "INV-101",
        invoiceDate: new Date("2026-09-01"),
        totalAmount: 1000,
        paidAmount: 400,
        balanceDue: 600,
        status: "PARTIAL",
        items: [{ id: "i1", product: { name: "Drug A" } }],
      },
      {
        id: "inv-2",
        invoiceNumber: "INV-102",
        invoiceDate: new Date("2026-09-15"),
        totalAmount: 500,
        paidAmount: 0,
        balanceDue: 500,
        status: "UNPAID",
        items: [{ id: "i2", product: { name: "Drug B" } }],
      },
    ]);

    prismaMock.distributorPayment.findMany.mockResolvedValueOnce([
      {
        id: "pay-1",
        amount: 400,
        paidAt: new Date("2026-09-05"),
        paymentMethod: "BANK_TRANSFER",
        referenceNumber: "TXN-881",
        notes: "Partial payment for INV-101",
        invoice: { invoiceNumber: "INV-101" },
      },
    ]);

    const ledger = await purchasesService.getDistributorLedger(scope, "dist-1");

    expect(ledger.summary.totalInvoiced).toBe(1500);
    expect(ledger.summary.totalPaid).toBe(400);
    expect(ledger.summary.outstandingBalance).toBe(1100);
    expect(ledger.summary.unpaidInvoicesCount).toBe(2);

    // Statement events should be correctly ordered and calculate running balances
    expect(ledger.statement).toHaveLength(3);
    // Recent first: INV-102 (+500 -> 1100), PAY-1 (-400 -> 600), INV-101 (+1000 -> 1000)
    expect(ledger.statement[0].refNumber).toBe("INV-102");
    expect(ledger.statement[0].runningBalance).toBe(1100);
  });
});
