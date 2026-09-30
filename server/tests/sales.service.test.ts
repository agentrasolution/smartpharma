import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    sale: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    saleItem: {
      create: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    batch: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    prescription: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    prescriptionItem: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    arrear: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(prismaMock)),
  };
  return { prismaMock };
});

vi.mock("../src/services/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/socket", () => ({ emitEvent: vi.fn() }));
vi.mock("../src/modules/inventory/batch.service", () => ({
  batchService: {
    allocateFefo: vi.fn().mockResolvedValue([{ batchId: "batch-fefo-1", unitsConsumed: 2 }]),
  },
}));

import { salesService } from "../src/modules/sales/sales.service";

describe("salesService (Pillar F: POS & Sales Operations)", () => {
  const scope = {
    pharmacyId: "pharmacy-1",
    branchId: "branch-1",
    userRole: "CASHIER",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.sale.findFirst.mockResolvedValue(null); // Next num = 1
  });

  it("creates a cash sale, performs FEFO allocation, records batch details and deducts stock", async () => {
    prismaMock.sale.create.mockResolvedValue({
      id: "2609-000001",
      subtotal: 50,
      discount: 0,
      total: 50,
      amountPaid: 50,
      paymentMethod: "CASH",
    });

    prismaMock.batch.count.mockResolvedValue(2);
    prismaMock.batch.findUnique.mockResolvedValue({
      id: "batch-fefo-1",
      batchNumber: "B-2026-FEFO",
      expiryDate: new Date("2027-01-01"),
      costPricePerUnit: 15,
    });

    prismaMock.sale.findUnique.mockResolvedValue({
      id: "2609-000001",
      total: 50,
      amountPaid: 50,
      paymentMethod: "CASH",
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          quantity: 2,
          batchNumber: "B-2026-FEFO",
        },
      ],
    });

    const result = await salesService.create(
      {
        subtotal: 50,
        discount: 0,
        total: 50,
        amountPaid: 50,
        paymentMethod: "CASH",
        items: [
          {
            productId: "prod-1",
            productName: "Paracetamol 500mg",
            barcode: "1234567890123",
            quantity: 2,
            unitPrice: 25,
            subtotal: 50,
          },
        ],
      },
      scope
    );

    expect(prismaMock.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: "CASH",
          cashAmount: 50,
          status: "paid",
        }),
      })
    );

    // Verify product stock decremented
    expect(prismaMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data: { stockQty: { decrement: 2 } },
      })
    );

    // Verify SaleItem created with allocated batch info, unitCost & cogs
    expect(prismaMock.saleItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          batchId: "batch-fefo-1",
          batchNumber: "B-2026-FEFO",
          unitCost: 15,
          cogs: 30,
        }),
      })
    );

    // Verify Sale updated with COGS and Gross Profit
    expect(prismaMock.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "2609-000001" },
        data: expect.objectContaining({
          totalCogs: 30,
          grossProfit: 20, // 50 subtotal - 30 cogs
        }),
      })
    );

    expect(result?.id).toBe("2609-000001");
  });

  it("handles split payment tender (part cash, part card)", async () => {
    prismaMock.sale.create.mockResolvedValue({
      id: "2609-000002",
      total: 100,
      amountPaid: 100,
      paymentMethod: "SPLIT",
      cashAmount: 40,
      cardAmount: 60,
    });

    prismaMock.batch.count.mockResolvedValue(0); // Legacy path
    prismaMock.batch.aggregate.mockResolvedValue({ _sum: { quantityInBaseUnits: 10 } });

    prismaMock.sale.findUnique.mockResolvedValue({
      id: "2609-000002",
      total: 100,
      amountPaid: 100,
      paymentMethod: "SPLIT",
    });

    await salesService.create(
      {
        subtotal: 100,
        discount: 0,
        total: 100,
        amountPaid: 100,
        paymentMethod: "SPLIT",
        cashAmount: 40,
        cardAmount: 60,
        items: [
          {
            productId: "prod-2",
            productName: "Cough Syrup",
            barcode: "9876543210987",
            quantity: 1,
            unitPrice: 100,
            subtotal: 100,
          },
        ],
      },
      scope
    );

    expect(prismaMock.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: "SPLIT",
          cashAmount: 40,
          cardAmount: 60,
          amountPaid: 100,
        }),
      })
    );
  });

  it("links sale to prescription, updating prescription items and completion status", async () => {
    prismaMock.sale.create.mockResolvedValue({
      id: "2609-000003",
      total: 80,
      amountPaid: 80,
      prescriptionId: "rx-99",
    });

    prismaMock.batch.count.mockResolvedValue(0);
    prismaMock.batch.aggregate.mockResolvedValue({ _sum: { quantityInBaseUnits: 20 } });

    prismaMock.prescription.findFirst.mockResolvedValue({
      id: "rx-99",
      items: [
        {
          id: "rx-item-1",
          productId: "prod-rx-1",
          prescribedDrugName: "Amoxicillin 500mg",
          quantityPrescribed: 10,
          quantityDispensed: 0,
          quantityRemaining: 10,
        },
      ],
    });

    // After dispensing 10, 0 remain
    prismaMock.prescriptionItem.findMany.mockResolvedValue([
      { id: "rx-item-1", quantityRemaining: 0 },
    ]);

    prismaMock.sale.findUnique.mockResolvedValue({
      id: "2609-000003",
      prescriptionId: "rx-99",
    });

    await salesService.create(
      {
        subtotal: 80,
        discount: 0,
        total: 80,
        amountPaid: 80,
        prescriptionId: "rx-99",
        prescriptionNumber: "RX-2609-000099",
        items: [
          {
            productId: "prod-rx-1",
            productName: "Amoxicillin 500mg",
            barcode: "5551112223334",
            quantity: 10,
            unitPrice: 8,
            subtotal: 80,
          },
        ],
      },
      scope
    );

    // Verify prescription item quantity updated
    expect(prismaMock.prescriptionItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rx-item-1" },
        data: expect.objectContaining({
          quantityDispensed: 10,
          quantityRemaining: 0,
          status: "COMPLETED",
        }),
      })
    );

    // Verify prescription marked FULLY_DISPENSED
    expect(prismaMock.prescription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rx-99" },
        data: { status: "FULLY_DISPENSED" },
      })
    );
  });

  it("creates customer arrear when amount paid is less than total bill", async () => {
    prismaMock.sale.create.mockResolvedValue({
      id: "2609-000004",
      total: 150,
      amountPaid: 50,
      status: "partial",
    });

    prismaMock.batch.count.mockResolvedValue(0);
    prismaMock.batch.aggregate.mockResolvedValue({ _sum: { quantityInBaseUnits: 15 } });

    prismaMock.sale.findUnique.mockResolvedValue({
      id: "2609-000004",
      total: 150,
      amountPaid: 50,
      status: "partial",
    });

    await salesService.create(
      {
        customerId: "cust-1",
        subtotal: 150,
        discount: 0,
        total: 150,
        amountPaid: 50,
        paymentMethod: "CREDIT",
        items: [
          {
            productId: "prod-3",
            productName: "Insulin Pen",
            barcode: "7778889990001",
            quantity: 1,
            unitPrice: 150,
            subtotal: 150,
          },
        ],
      },
      scope
    );

    // Verify arrear was created for remaining balance
    expect(prismaMock.arrear.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "cust-1",
          totalBill: 150,
          amountPaid: 50,
          balanceDue: 100,
          status: "pending",
        }),
      })
    );
  });
});
