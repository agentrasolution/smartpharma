import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    branch: {
      findFirst: vi.fn(),
    },
    prescription: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    prescriptionItem: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    dispenseRecord: {
      create: vi.fn(),
    },
    controlledDrugRegister: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    batch: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(prismaMock)),
  };
  return { prismaMock };
});

vi.mock("../src/services/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/socket", () => ({ emitEvent: vi.fn() }));

import { dispensingService } from "../src/modules/dispensing/dispensing.service";

describe("dispensingService (Pillar E: Dispensing & Prescriptions)", () => {
  const scope = {
    pharmacyId: "pharmacy-1",
    branchId: "branch-1",
    userRole: "PHARMACIST",
  };

  const pharmacist = {
    id: "user-pharm-1",
    name: "Dr. Sarah Licensed Pharmacist",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.branch.findFirst.mockResolvedValue({ id: "branch-1", name: "Main Branch" });
  });

  describe("Prescription Capture", () => {
    it("creates a standard prescription with auto-generated Rx number", async () => {
      prismaMock.prescription.create.mockResolvedValue({
        id: "rx-1",
        pharmacyId: "pharmacy-1",
        branchId: "branch-1",
        prescriptionNumber: "RX-2609-123456",
        patientName: "John Doe",
        doctorName: "Dr. Smith",
        status: "PENDING",
        items: [
          {
            id: "item-1",
            prescribedDrugName: "Amoxicillin 500mg",
            quantityPrescribed: 20,
            quantityRemaining: 20,
            isControlled: false,
          },
        ],
      });

      const result = await dispensingService.createPrescription(scope, {
        patientName: "John Doe",
        doctorName: "Dr. Smith",
        items: [
          {
            prescribedDrugName: "Amoxicillin 500mg",
            quantityPrescribed: 20,
            isControlled: false,
          },
        ],
      });

      expect(result.id).toBe("rx-1");
      expect(result.status).toBe("PENDING");
      expect(prismaMock.prescription.create).toHaveBeenCalledTimes(1);
    });

    it("rejects controlled medication prescriptions if patient identifier or doctor license is missing", async () => {
      await expect(
        dispensingService.createPrescription(scope, {
          patientName: "Jane Doe",
          patientIdentifier: "", // Missing
          doctorName: "Dr. Adams",
          doctorLicense: "", // Missing
          items: [
            {
              prescribedDrugName: "Alprazolam 0.5mg",
              quantityPrescribed: 30,
              isControlled: true,
            },
          ],
        })
      ).rejects.toThrow("Patient Identifier");
    });

    it("accepts controlled medication prescription when patient identifier and doctor license are provided", async () => {
      prismaMock.prescription.create.mockResolvedValue({
        id: "rx-controlled-1",
        prescriptionNumber: "RX-CTRL-001",
        patientName: "Jane Doe",
        patientIdentifier: "ID-9876543210",
        doctorName: "Dr. Adams",
        doctorLicense: "MD-LIC-44552",
        status: "PENDING",
        items: [
          {
            id: "item-c1",
            prescribedDrugName: "Alprazolam 0.5mg",
            quantityPrescribed: 30,
            isControlled: true,
          },
        ],
      });

      const result = await dispensingService.createPrescription(scope, {
        patientName: "Jane Doe",
        patientIdentifier: "ID-9876543210",
        doctorName: "Dr. Adams",
        doctorLicense: "MD-LIC-44552",
        items: [
          {
            prescribedDrugName: "Alprazolam 0.5mg",
            quantityPrescribed: 30,
            isControlled: true,
          },
        ],
      });

      expect(result.id).toBe("rx-controlled-1");
      expect(prismaMock.prescription.create).toHaveBeenCalled();
    });
  });

  describe("Pharmacist Verification Workflow", () => {
    it("transitions prescription status from PENDING to VERIFIED with pharmacist credentials", async () => {
      prismaMock.prescription.findFirst.mockResolvedValue({
        id: "rx-1",
        pharmacyId: "pharmacy-1",
        status: "PENDING",
        notes: "Prior note",
      });

      prismaMock.prescription.update.mockResolvedValue({
        id: "rx-1",
        status: "VERIFIED",
        verifiedById: pharmacist.id,
        verifiedByName: pharmacist.name,
        verifiedAt: new Date(),
        notes: "Prior note\n[Verification Note]: Verified patient dosage and allergy history.",
        items: [],
      });

      const verified = await dispensingService.verifyPrescription(
        scope,
        "rx-1",
        { verified: true, notes: "Verified patient dosage and allergy history." },
        pharmacist
      );

      expect(verified.status).toBe("VERIFIED");
      expect(verified.verifiedByName).toBe(pharmacist.name);
      expect(prismaMock.prescription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rx-1" },
          data: expect.objectContaining({
            status: "VERIFIED",
            verifiedById: pharmacist.id,
          }),
        })
      );
    });

    it("prevents double-verification if prescription is not in PENDING state", async () => {
      prismaMock.prescription.findFirst.mockResolvedValue({
        id: "rx-1",
        pharmacyId: "pharmacy-1",
        status: "VERIFIED",
      });

      await expect(
        dispensingService.verifyPrescription(scope, "rx-1", { verified: true }, pharmacist)
      ).rejects.toThrow("cannot be verified again");
    });
  });

  describe("Brand-to-Generic Substitution Engine", () => {
    it("suggests in-stock bioequivalent alternatives with price comparison", async () => {
      prismaMock.product.findFirst.mockResolvedValue({
        id: "brand-lipitor",
        pharmacyId: "pharmacy-1",
        name: "Lipitor 20mg (Brand)",
        genericName: "Atorvastatin",
        dosageForm: "Tablet",
        strength: "20mg",
        salePrice: 120,
        batches: [{ quantityInBaseUnits: 15 }],
      });

      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "generic-atorva",
          name: "Atorva 20mg (Generic)",
          genericName: "Atorvastatin",
          dosageForm: "Tablet",
          strength: "20mg",
          salePrice: 45,
          batches: [
            {
              id: "batch-gen-1",
              batchNumber: "B-GEN-01",
              expiryDate: new Date("2027-12-31"),
              quantityInBaseUnits: 50,
            },
          ],
        },
      ]);

      const suggestions = await dispensingService.suggestSubstitutions(scope, "brand-lipitor");

      expect(suggestions.hasGenericAlternatives).toBe(true);
      expect(suggestions.substitutions).toHaveLength(1);
      const sub = suggestions.substitutions[0];
      expect(sub.name).toBe("Atorva 20mg (Generic)");
      expect(sub.priceDifference).toBe(75); // 120 - 45 = 75 savings
      expect(sub.isCheaper).toBe(true);
      expect(sub.sameDosageForm).toBe(true);
      expect(sub.stockQty).toBe(50);
    });
  });

  describe("Dispensing & Partial Fills", () => {
    it("refuses to dispense a prescription that has not been verified by a pharmacist", async () => {
      prismaMock.prescription.findFirst.mockResolvedValue({
        id: "rx-unverified",
        status: "PENDING",
        items: [{ id: "item-1", quantityRemaining: 10 }],
      });

      await expect(
        dispensingService.dispensePrescription(
          scope,
          "rx-unverified",
          {
            items: [
              {
                prescriptionItemId: "item-1",
                dispensedProductId: "prod-1",
                quantity: 5,
              },
            ],
          },
          pharmacist
        )
      ).rejects.toThrow("must be verified by a pharmacist");
    });

    it("executes partial dispensing, performs FEFO deduction, logs movement and updates status to PARTIALLY_DISPENSED", async () => {
      prismaMock.prescription.findFirst.mockResolvedValue({
        id: "rx-100",
        prescriptionNumber: "RX-100",
        patientName: "Sam Patient",
        patientIdentifier: "P-12345",
        doctorName: "Dr. House",
        doctorLicense: "MD-999",
        status: "VERIFIED",
        items: [
          {
            id: "item-rx-1",
            prescribedDrugName: "Augmentin 625mg",
            productId: "prod-brand-aug",
            quantityPrescribed: 20,
            quantityDispensed: 0,
            quantityRemaining: 20,
            isControlled: false,
          },
        ],
      });

      prismaMock.product.findFirst.mockResolvedValue({
        id: "prod-brand-aug",
        name: "Augmentin 625mg",
        stockQty: 50,
        isControlled: false,
        schedule: null,
      });

      // Active batches in FEFO order
      prismaMock.batch.findMany.mockResolvedValue([
        {
          id: "batch-aug-1",
          quantityInBaseUnits: 15,
          costPricePerUnit: 10,
          expiryDate: new Date("2027-01-01"),
        },
      ]);

      prismaMock.dispenseRecord.create.mockResolvedValue({
        id: "dispense-rec-1",
      });

      // After dispensing 5 units, 15 remain
      prismaMock.prescriptionItem.findMany.mockResolvedValue([
        { id: "item-rx-1", quantityRemaining: 15 },
      ]);

      prismaMock.prescription.update.mockResolvedValue({
        id: "rx-100",
        status: "PARTIALLY_DISPENSED",
      });

      const result = await dispensingService.dispensePrescription(
        scope,
        "rx-100",
        {
          items: [
            {
              prescriptionItemId: "item-rx-1",
              dispensedProductId: "prod-brand-aug",
              quantity: 5, // Partial fill: 5 of 20
            },
          ],
        },
        pharmacist
      );

      // Verify batch was updated: 15 - 5 = 10
      expect(prismaMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "batch-aug-1" },
          data: { quantityInBaseUnits: 10, status: "ACTIVE" },
        })
      );

      // Verify stock movement was created with PRESCRIPTION_DISPENSE
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: "PRESCRIPTION_DISPENSE",
            quantityDelta: -5,
          }),
        })
      );

      // Verify product stock decremented
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: "prod-brand-aug" },
        data: { stockQty: { decrement: 5 } },
      });

      // Verify item remaining updated
      expect(prismaMock.prescriptionItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "item-rx-1" },
          data: {
            quantityDispensed: 5,
            quantityRemaining: 15,
            status: "PARTIAL",
          },
        })
      );

      // Overall prescription moved to PARTIALLY_DISPENSED
      expect(result.status).toBe("PARTIALLY_DISPENSED");
    });

    it("logs controlled drug register entry when dispensing a controlled medication", async () => {
      prismaMock.prescription.findFirst.mockResolvedValue({
        id: "rx-ctrl",
        prescriptionNumber: "RX-CTRL-77",
        patientName: "Alice Miller",
        patientIdentifier: "NAT-ID-11223344",
        doctorName: "Dr. Watson",
        doctorLicense: "DOC-998811",
        status: "VERIFIED",
        items: [
          {
            id: "item-ctrl-1",
            prescribedDrugName: "Diazepam 5mg",
            productId: "prod-diazepam",
            quantityPrescribed: 10,
            quantityDispensed: 0,
            quantityRemaining: 10,
            isControlled: true,
          },
        ],
      });

      prismaMock.product.findFirst.mockResolvedValue({
        id: "prod-diazepam",
        name: "Diazepam 5mg",
        stockQty: 30,
        isControlled: true,
        schedule: "Schedule IV",
      });

      prismaMock.batch.findMany
        .mockResolvedValueOnce([
          {
            id: "batch-diaz-1",
            quantityInBaseUnits: 30,
            costPricePerUnit: 5,
            expiryDate: new Date("2027-06-01"),
          },
        ])
        .mockResolvedValueOnce([{ quantityInBaseUnits: 20 }]); // Balance remaining for register

      prismaMock.dispenseRecord.create.mockResolvedValue({ id: "disp-ctrl-rec" });
      prismaMock.prescriptionItem.findMany.mockResolvedValue([
        { id: "item-ctrl-1", quantityRemaining: 0 },
      ]);
      prismaMock.prescription.update.mockResolvedValue({
        id: "rx-ctrl",
        status: "FULLY_DISPENSED",
      });

      const result = await dispensingService.dispensePrescription(
        scope,
        "rx-ctrl",
        {
          items: [
            {
              prescriptionItemId: "item-ctrl-1",
              dispensedProductId: "prod-diazepam",
              quantity: 10, // Full fill
              witnessName: "Nurse Nancy",
            },
          ],
        },
        pharmacist
      );

      // Verify controlled drug register creation
      expect(prismaMock.controlledDrugRegister.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-diazepam",
            patientName: "Alice Miller",
            patientIdentifier: "NAT-ID-11223344",
            doctorLicense: "DOC-998811",
            transactionType: "DISPENSE",
            quantity: 10,
            witnessName: "Nurse Nancy",
            pharmacistName: pharmacist.name,
          }),
        })
      );

      expect(result.status).toBe("FULLY_DISPENSED");
    });
  });

  describe("Controlled Drug Register Query", () => {
    it("queries controlled register with patient, doctor, and balance audit trail", async () => {
      prismaMock.controlledDrugRegister.findMany.mockResolvedValue([
        {
          id: "cdr-1",
          patientName: "Alice Miller",
          patientIdentifier: "NAT-ID-11223344",
          doctorName: "Dr. Watson",
          doctorLicense: "DOC-998811",
          quantity: 10,
          balanceAfter: 20,
          transactionType: "DISPENSE",
          pharmacistName: pharmacist.name,
          recordedAt: new Date(),
          product: { name: "Diazepam 5mg", genericName: "Diazepam", schedule: "Schedule IV" },
          batch: { batchNumber: "B-DIAZ-01" },
          prescription: { prescriptionNumber: "RX-CTRL-77" },
        },
      ]);

      const log = await dispensingService.getControlledDrugRegister(scope, {
        search: "Alice",
      });

      expect(log).toHaveLength(1);
      expect(log[0].patientName).toBe("Alice Miller");
      expect(log[0].balanceAfter).toBe(20);
      expect(prismaMock.controlledDrugRegister.findMany).toHaveBeenCalled();
    });
  });
});
