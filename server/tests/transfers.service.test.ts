import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    branch: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    batch: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    stockTransfer: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    stockTransferItem: {
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    branchPriceOverride: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(prismaMock)),
  };
  return { prismaMock };
});

vi.mock("../src/services/prisma", () => ({ prisma: prismaMock }));

import { transfersService } from "../src/modules/branches/transfers.service";

describe("transfersService (Pillar G: Multi-Branch Operations & Batch Travel)", () => {
  const scope = {
    pharmacyId: "pharm-main",
    branchId: "branch-src",
    userRole: "MANAGER",
  };

  const user = {
    id: "usr-1",
    name: "Pharmacist Operations",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTransfer", () => {
    it("should reject transfer if source and destination branches are identical", async () => {
      await expect(
        transfersService.createTransfer(
          scope,
          {
            sourceBranchId: "branch-src",
            destinationBranchId: "branch-src",
            items: [{ productId: "prod-1", quantity: 5 }],
          },
          user,
        ),
      ).rejects.toThrow("Source and destination branches cannot be the same");
    });

    it("should create a PENDING transfer with FEFO batch selected when none specified", async () => {
      prismaMock.branch.findFirst
        .mockResolvedValueOnce({ id: "branch-src", name: "Downtown Branch" })
        .mockResolvedValueOnce({ id: "branch-dest", name: "Uptown Branch" });

      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "prod-1",
        name: "Amoxicillin 500mg",
        barcode: "AMX500",
        purchasePrice: 10.5,
        salePrice: 15.0,
      });

      prismaMock.batch.findFirst.mockResolvedValueOnce({
        id: "batch-src-1",
        batchNumber: "B-2026-AMX",
        expiryDate: new Date("2027-06-30"),
        quantityInBaseUnits: 50,
        costPricePerUnit: 10.5,
        salePricePerUnit: 15.0,
      });

      prismaMock.stockTransfer.create.mockImplementationOnce(async ({ data }: any) => ({
        id: "trf-101",
        transferNumber: data.transferNumber,
        status: "PENDING",
        sourceBranchId: "branch-src",
        destinationBranchId: "branch-dest",
        items: data.items.create,
      }));

      const result = await transfersService.createTransfer(
        scope,
        {
          sourceBranchId: "branch-src",
          destinationBranchId: "branch-dest",
          notes: "Replenish antibiotic shortage",
          items: [{ productId: "prod-1", quantity: 10 }],
        },
        user,
      );

      expect(result.id).toBe("trf-101");
      expect(result.status).toBe("PENDING");
      expect(prismaMock.stockTransfer.create).toHaveBeenCalled();
    });
  });

  describe("sendTransfer", () => {
    it("should decrement source batch and product stock, and log TRANSFER_OUT movement", async () => {
      const mockTransfer = {
        id: "trf-101",
        transferNumber: "TRF-2026-888999",
        status: "PENDING",
        pharmacyId: "pharm-main",
        sourceBranchId: "branch-src",
        destinationBranchId: "branch-dest",
        sourceBranch: { id: "branch-src", name: "Downtown Branch" },
        destinationBranch: { id: "branch-dest", name: "Uptown Branch" },
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            productName: "Amoxicillin 500mg",
            barcode: "AMX500",
            sourceBatchId: "batch-src-1",
            batchNumber: "B-2026-AMX",
            expiryDate: new Date("2027-06-30"),
            quantity: 10,
            unitCost: 10.5,
            salePrice: 15.0,
          },
        ],
      };

      prismaMock.stockTransfer.findFirst.mockResolvedValueOnce(mockTransfer);
      prismaMock.batch.findUnique.mockResolvedValueOnce({
        id: "batch-src-1",
        quantityInBaseUnits: 50,
      });

      prismaMock.batch.update.mockResolvedValueOnce({
        id: "batch-src-1",
        quantityInBaseUnits: 40,
        status: "ACTIVE",
      });

      prismaMock.product.update.mockResolvedValueOnce({
        id: "prod-1",
        stockQty: 40,
      });

      prismaMock.stockMovement.create.mockResolvedValueOnce({ id: "sm-out-1" });

      prismaMock.stockTransfer.update.mockResolvedValueOnce({
        ...mockTransfer,
        status: "IN_TRANSIT",
        approvedById: user.id,
        approvedByName: user.name,
      });

      const result = await transfersService.sendTransfer(scope, "trf-101", user);

      expect(result.status).toBe("IN_TRANSIT");

      // Verify source batch deducted
      expect(prismaMock.batch.update).toHaveBeenCalledWith({
        where: { id: "batch-src-1" },
        data: { quantityInBaseUnits: 40, status: "ACTIVE" },
      });

      // Verify product stock deducted
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { stockQty: { decrement: 10 } },
      });

      // Verify TRANSFER_OUT immutable movement
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: "TRANSFER_OUT",
            quantityDelta: -10,
            referenceNumber: "TRF-2026-888999",
            createdById: user.id,
          }),
        }),
      );
    });
  });

  describe("receiveTransfer with Batch Travel", () => {
    it("should provision batch with exact batchNumber, expiryDate, and unitCost at destination branch", async () => {
      const destScope = {
        pharmacyId: "pharm-main",
        branchId: "branch-dest",
        userRole: "MANAGER",
      };

      const mockTransferInTransit = {
        id: "trf-101",
        transferNumber: "TRF-2026-888999",
        status: "IN_TRANSIT",
        pharmacyId: "pharm-main",
        sourceBranchId: "branch-src",
        destinationBranchId: "branch-dest",
        sourceBranch: { id: "branch-src", name: "Downtown Branch" },
        destinationBranch: { id: "branch-dest", name: "Uptown Branch" },
        items: [
          {
            id: "item-1",
            productId: "prod-src-1",
            productName: "Amoxicillin 500mg",
            barcode: "AMX500",
            batchNumber: "B-2026-AMX",
            expiryDate: new Date("2027-06-30"),
            quantity: 10,
            unitCost: 10.5,
            salePrice: 15.0,
            product: {
              barcode: "AMX500",
              name: "Amoxicillin 500mg",
              nameEn: "Amoxicillin 500mg",
              nameAr: "أموكسيسيلين",
              genericName: "Amoxicillin",
              dosageForm: "CAPSULE",
              strength: "500mg",
              company: "PharmaCorp",
              category: "Antibiotics",
              location: "Shelf A2",
              markupPercent: 20,
              packSize: 20,
              baseUnit: "CAPSULE",
              packageUnit: "BOX",
              unitsPerPack: 20,
              isRx: true,
              isControlled: false,
              isPriceRegulated: false,
              publicPrice: 15.0,
              sfdaCode: null,
            },
          },
        ],
      };

      prismaMock.stockTransfer.findFirst.mockResolvedValueOnce(mockTransferInTransit);

      // Destination branch already has product record
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "prod-dest-1",
        branchId: "branch-dest",
        barcode: "AMX500",
        stockQty: 5,
      });

      // Destination branch does NOT have this batch yet -> must create with batch travel!
      prismaMock.batch.findUnique.mockResolvedValueOnce(null);

      prismaMock.batch.create.mockResolvedValueOnce({
        id: "batch-dest-new",
        branchId: "branch-dest",
        productId: "prod-dest-1",
        batchNumber: "B-2026-AMX",
        expiryDate: new Date("2027-06-30"),
        quantityInBaseUnits: 10,
        costPricePerUnit: 10.5,
        salePricePerUnit: 15.0,
        status: "ACTIVE",
      });

      prismaMock.product.update.mockResolvedValueOnce({
        id: "prod-dest-1",
        stockQty: 15,
      });

      prismaMock.stockMovement.create.mockResolvedValueOnce({ id: "sm-in-1" });
      prismaMock.stockTransferItem.update.mockResolvedValueOnce({ id: "item-1" });

      prismaMock.stockTransfer.update.mockResolvedValueOnce({
        ...mockTransferInTransit,
        status: "RECEIVED",
        receivedById: user.id,
        receivedByName: user.name,
      });

      const result = await transfersService.receiveTransfer(destScope, "trf-101", user);

      expect(result.status).toBe("RECEIVED");

      // Verify batch created at destination branch with traveled batch number, expiry date, and unit cost
      expect(prismaMock.batch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          branchId: "branch-dest",
          productId: "prod-dest-1",
          batchNumber: "B-2026-AMX",
          expiryDate: new Date("2027-06-30"),
          quantityInBaseUnits: 10,
          costPricePerUnit: 10.5,
          salePricePerUnit: 15.0,
          status: "ACTIVE",
        }),
      });

      // Verify destination product stock incremented
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: "prod-dest-1" },
        data: { stockQty: { increment: 10 } },
      });

      // Verify immutable TRANSFER_IN logged
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            branchId: "branch-dest",
            movementType: "TRANSFER_IN",
            quantityDelta: 10,
            referenceNumber: "TRF-2026-888999",
          }),
        }),
      );
    });
  });

  describe("rejectTransfer", () => {
    it("should restore stock to source branch if transfer was IN_TRANSIT", async () => {
      const mockInTransit = {
        id: "trf-101",
        transferNumber: "TRF-2026-888999",
        status: "IN_TRANSIT",
        pharmacyId: "pharm-main",
        sourceBranchId: "branch-src",
        destinationBranchId: "branch-dest",
        sourceBranch: { id: "branch-src", name: "Downtown Branch" },
        destinationBranch: { id: "branch-dest", name: "Uptown Branch" },
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            sourceBatchId: "batch-src-1",
            quantity: 10,
            unitCost: 10.5,
          },
        ],
      };

      prismaMock.stockTransfer.findFirst.mockResolvedValueOnce(mockInTransit);
      prismaMock.batch.update.mockResolvedValueOnce({ id: "batch-src-1" });
      prismaMock.product.update.mockResolvedValueOnce({ id: "prod-1", stockQty: 50 });
      prismaMock.stockMovement.create.mockResolvedValueOnce({ id: "sm-revert-1" });
      prismaMock.stockTransfer.update.mockResolvedValueOnce({
        ...mockInTransit,
        status: "REJECTED",
        rejectionReason: "Damaged during transit",
      });

      const result = await transfersService.rejectTransfer(
        scope,
        "trf-101",
        "Damaged during transit",
        user,
      );

      expect(result.status).toBe("REJECTED");
      expect(prismaMock.batch.update).toHaveBeenCalledWith({
        where: { id: "batch-src-1" },
        data: {
          quantityInBaseUnits: { increment: 10 },
          status: "ACTIVE",
        },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: "TRANSFER_REVERT",
            quantityDelta: 10,
          }),
        }),
      );
    });
  });

  describe("Cross-Branch Stock Visibility", () => {
    it("should return stock levels, active batches, and overrides for all pharmacy branches", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "prod-1",
        name: "Panadol Extra 500mg",
        barcode: "PAN500",
      });

      prismaMock.branch.findMany.mockResolvedValueOnce([
        {
          id: "branch-1",
          name: "Main Branch",
          address: "123 King St",
          phone: "555-0101",
          allowPriceOverride: true,
        },
        {
          id: "branch-2",
          name: "Airport Branch",
          address: "Terminal 2",
          phone: "555-0102",
          allowPriceOverride: false,
        },
      ]);

      prismaMock.product.findMany.mockResolvedValueOnce([
        {
          id: "prod-b1",
          branchId: "branch-1",
          barcode: "PAN500",
          salePrice: 12.0,
          stockQty: 80,
          updatedAt: new Date("2026-09-30T10:00:00Z"),
          branchPriceOverrides: [],
          batches: [
            {
              id: "b1-1",
              batchNumber: "PAN-B1",
              expiryDate: new Date("2027-12-31"),
              quantityInBaseUnits: 80,
              costPricePerUnit: 8.0,
              salePricePerUnit: 12.0,
              isRecalled: false,
              status: "ACTIVE",
            },
          ],
        },
        {
          id: "prod-b2",
          branchId: "branch-2",
          barcode: "PAN500",
          salePrice: 12.0,
          stockQty: 30,
          updatedAt: new Date("2026-09-30T11:00:00Z"),
          branchPriceOverrides: [],
          batches: [
            {
              id: "b2-1",
              batchNumber: "PAN-B2",
              expiryDate: new Date("2028-01-31"),
              quantityInBaseUnits: 30,
              costPricePerUnit: 8.0,
              salePricePerUnit: 12.0,
              isRecalled: false,
              status: "ACTIVE",
            },
          ],
        },
      ]);

      prismaMock.stockMovement.groupBy.mockResolvedValueOnce([]);

      const result = await transfersService.getCrossBranchStock(scope, { barcode: "PAN500" });

      expect(result.productName).toBe("Panadol Extra 500mg");
      expect(result.barcode).toBe("PAN500");
      expect(result.totalStockAcrossAllBranches).toBe(110);
      expect(result.branches).toHaveLength(2);
      expect(result.branches[0].stockQty).toBe(80);
      expect(result.branches[0].batches).toHaveLength(1);
      expect(result.branches[1].stockQty).toBe(30);
    });
  });

  describe("Branch Price Overrides", () => {
    it("should allow price override when branch.allowPriceOverride is true", async () => {
      prismaMock.branch.findFirst.mockResolvedValueOnce({
        id: "branch-1",
        name: "Main Branch",
        allowPriceOverride: true,
      });

      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "prod-1",
        name: "Aspirin 100mg",
        barcode: "ASP100",
        salePrice: 5.0,
      });

      prismaMock.branchPriceOverride.upsert.mockResolvedValueOnce({
        id: "bpo-1",
        branchId: "branch-1",
        productId: "prod-1",
        salePrice: 6.5,
        reason: "Airport premium pricing",
        effectiveDate: new Date(),
        product: { id: "prod-1", name: "Aspirin 100mg", barcode: "ASP100", salePrice: 5.0 },
      });

      const result = await transfersService.setBranchPriceOverride(scope, "branch-1", {
        productId: "prod-1",
        salePrice: 6.5,
        reason: "Airport premium pricing",
      });

      expect(result.overridePrice).toBe(6.5);
      expect(result.catalogPrice).toBe(5.0);
    });

    it("should reject price override when branch.allowPriceOverride is false", async () => {
      prismaMock.branch.findFirst.mockResolvedValueOnce({
        id: "branch-locked",
        name: "Locked Pricing Branch",
        allowPriceOverride: false,
      });

      await expect(
        transfersService.setBranchPriceOverride(scope, "branch-locked", {
          productId: "prod-1",
          salePrice: 6.5,
          reason: "Attempt override",
        }),
      ).rejects.toThrow("Price overrides are disabled for branch");
    });
  });
});
