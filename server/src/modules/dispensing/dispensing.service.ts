/**
 * dispensing.service.ts
 * Pillar E – Dispensing & Prescription Management
 *
 * Core capabilities:
 * 1. Manual prescription capture with patient identifiers & doctor credentials.
 * 2. Pharmacist verification workflow (PENDING -> VERIFIED).
 * 3. Brand-to-generic substitution engine (suggesting in-stock alternatives by genericName & dosageForm).
 * 4. Partial dispensing management (tracking quantityDispensed and quantityRemaining).
 * 5. FEFO batch stock deduction with immutable StockMovement records.
 * 6. Controlled-drug register audit trail with running balances, doctor license, and witness.
 */

import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import { emitEvent } from "../../socket";
import type { BranchScope } from "../../middleware/auth";
import type {
  CreatePrescriptionInput,
  VerifyPrescriptionInput,
  DispensePrescriptionInput,
  ListPrescriptionsQuery,
  ControlledRegisterQuery,
} from "./dispensing.schema";

function branchWhere(scope: BranchScope) {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

async function resolveBranchId(scope: BranchScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const branch = await prisma.branch.findFirst({
    where: { pharmacyId: scope.pharmacyId },
    orderBy: { createdAt: "asc" },
  });
  if (!branch) {
    throw new BadRequestError("No pharmacy branch found to record dispensing");
  }
  return branch.id;
}

function generatePrescriptionNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `RX-${yy}${mm}-${rand}`;
}

export const dispensingService = {
  /**
   * 1. CREATE PRESCRIPTION
   * Captures manual prescription with patient details, doctor credentials, and items.
   */
  async createPrescription(scope: BranchScope, data: CreatePrescriptionInput) {
    const branchId = await resolveBranchId(scope);
    const rxNumber = data.prescriptionNumber?.trim() || generatePrescriptionNumber();

    // Check if any item is marked controlled or associated with a controlled product
    let hasControlledItem = data.items.some((item) => item.isControlled);

    // If products are linked, inspect if any are flagged controlled or scheduled in the drug master
    const productIds = data.items.map((i) => i.productId).filter(Boolean) as string[];
    if (productIds.length > 0) {
      const linkedProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, pharmacyId: scope.pharmacyId },
        select: { id: true, isControlled: true, schedule: true },
      });
      for (const p of linkedProducts) {
        if (p.isControlled || (p.schedule && p.schedule.trim() !== "")) {
          hasControlledItem = true;
          // Mark the corresponding item as controlled
          const item = data.items.find((i) => i.productId === p.id);
          if (item) item.isControlled = true;
        }
      }
    }

    // Controlled substance regulatory validation: requires patient identifier and doctor license
    if (hasControlledItem) {
      if (!data.patientIdentifier?.trim()) {
        throw new BadRequestError(
          "Patient Identifier (National ID / Iqama / Passport / Phone) is required for controlled medications."
        );
      }
      if (!data.doctorLicense?.trim()) {
        throw new BadRequestError(
          "Doctor License Number is required for controlled medications."
        );
      }
    }

    const prescription = await prisma.prescription.create({
      data: {
        pharmacyId: scope.pharmacyId,
        branchId,
        prescriptionNumber: rxNumber,
        patientName: data.patientName.trim(),
        patientIdentifier: data.patientIdentifier?.trim() ?? "",
        patientPhone: data.patientPhone?.trim() ?? "",
        patientAge: data.patientAge ?? null,
        patientGender: data.patientGender ?? null,
        doctorName: data.doctorName.trim(),
        doctorLicense: data.doctorLicense?.trim() ?? "",
        clinicOrHospital: data.clinicOrHospital?.trim() ?? "",
        diagnosis: data.diagnosis?.trim() ?? "",
        prescribedDate: data.prescribedDate ? new Date(data.prescribedDate) : new Date(),
        status: "PENDING",
        notes: data.notes?.trim() ?? "",
        items: {
          create: data.items.map((item) => ({
            prescribedDrugName: item.prescribedDrugName.trim(),
            productId: item.productId ?? null,
            dosage: item.dosage?.trim() ?? "",
            frequency: item.frequency?.trim() ?? "",
            duration: item.duration?.trim() ?? "",
            instructions: item.instructions?.trim() ?? "",
            quantityPrescribed: item.quantityPrescribed,
            quantityDispensed: 0,
            quantityRemaining: item.quantityPrescribed,
            status: "PENDING",
            isControlled: Boolean(item.isControlled),
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                genericName: true,
                dosageForm: true,
                salePrice: true,
                stockQty: true,
                isControlled: true,
                schedule: true,
              },
            },
          },
        },
      },
    });

    emitEvent("prescription:created", prescription);
    return prescription;
  },

  /**
   * 2. LIST PRESCRIPTIONS
   */
  async listPrescriptions(scope: BranchScope, query: ListPrescriptionsQuery = {}) {
    const where: any = {
      pharmacyId: scope.pharmacyId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
    };

    if (query.status && query.status !== "ALL") {
      where.status = query.status;
    }

    if (query.patientIdentifier) {
      where.patientIdentifier = { contains: query.patientIdentifier, mode: "insensitive" };
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { prescriptionNumber: { contains: s, mode: "insensitive" } },
        { patientName: { contains: s, mode: "insensitive" } },
        { patientPhone: { contains: s, mode: "insensitive" } },
        { doctorName: { contains: s, mode: "insensitive" } },
        { patientIdentifier: { contains: s, mode: "insensitive" } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.prescribedDate = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    return prisma.prescription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                genericName: true,
                dosageForm: true,
                salePrice: true,
                stockQty: true,
                isControlled: true,
                schedule: true,
              },
            },
          },
        },
        dispenseRecords: {
          include: {
            dispensedProduct: { select: { id: true, name: true, genericName: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          },
        },
      },
    });
  },

  /**
   * 3. GET PRESCRIPTION BY ID
   */
  async getPrescriptionById(scope: BranchScope, id: string) {
    const prescription = await prisma.prescription.findFirst({
      where: {
        id,
        pharmacyId: scope.pharmacyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                batches: {
                  where: {
                    status: "ACTIVE",
                    quantityInBaseUnits: { gt: 0 },
                    ...(scope.branchId ? { branchId: scope.branchId } : {}),
                  },
                  orderBy: { expiryDate: "asc" },
                },
              },
            },
          },
        },
        dispenseRecords: {
          orderBy: { dispensedAt: "desc" },
          include: {
            dispensedProduct: { select: { id: true, name: true, genericName: true, salePrice: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          },
        },
        controlledRegisters: {
          orderBy: { recordedAt: "desc" },
          include: {
            product: { select: { id: true, name: true, genericName: true } },
            batch: { select: { id: true, batchNumber: true } },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundError("Prescription");
    }

    return prescription;
  },

  /**
   * 4. PHARMACIST VERIFICATION WORKFLOW
   * Changes status from PENDING -> VERIFIED with pharmacist ID, name, and timestamp.
   */
  async verifyPrescription(
    scope: BranchScope,
    id: string,
    data: VerifyPrescriptionInput,
    pharmacist: { id: string; name: string }
  ) {
    const rx = await prisma.prescription.findFirst({
      where: { id, pharmacyId: scope.pharmacyId },
    });
    if (!rx) throw new NotFoundError("Prescription");

    if (rx.status !== "PENDING") {
      throw new BadRequestError(`Prescription is already in '${rx.status}' status and cannot be verified again.`);
    }

    const updatedNotes = data.notes?.trim()
      ? (rx.notes ? `${rx.notes}\n[Verification Note]: ${data.notes.trim()}` : data.notes.trim())
      : rx.notes;

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status: "VERIFIED",
        verifiedById: pharmacist.id,
        verifiedByName: pharmacist.name,
        verifiedAt: new Date(),
        notes: updatedNotes,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    emitEvent("prescription:verified", updated);
    return updated;
  },

  /**
   * 5. BRAND-TO-GENERIC SUBSTITUTION ENGINE
   * Suggests alternatives currently in stock that share the identical generic name and dosage form.
   */
  async suggestSubstitutions(scope: BranchScope, productId: string) {
    const original = await prisma.product.findFirst({
      where: { id: productId, pharmacyId: scope.pharmacyId },
      include: {
        batches: {
          where: {
            status: "ACTIVE",
            quantityInBaseUnits: { gt: 0 },
            ...(scope.branchId ? { branchId: scope.branchId } : {}),
          },
        },
      },
    });

    if (!original) {
      throw new NotFoundError("Product");
    }

    if (!original.genericName || original.genericName.trim() === "") {
      return {
        originalProduct: original,
        hasGenericAlternatives: false,
        substitutions: [],
      };
    }

    const genericTrimmed = original.genericName.trim();

    // Query active products sharing the generic name
    const candidates = await prisma.product.findMany({
      where: {
        pharmacyId: scope.pharmacyId,
        id: { not: original.id },
        genericName: { equals: genericTrimmed, mode: "insensitive" },
        active: 1,
      },
      include: {
        batches: {
          where: {
            status: "ACTIVE",
            quantityInBaseUnits: { gt: 0 },
            ...(scope.branchId ? { branchId: scope.branchId } : {}),
          },
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    const origPrice = Number(original.salePrice ?? 0);

    const substitutions = candidates.map((cand) => {
      const totalStock = cand.batches.reduce((sum, b) => sum + b.quantityInBaseUnits, 0);
      const candPrice = Number(cand.salePrice ?? 0);
      const priceDifference = origPrice - candPrice; // positive = customer saves money
      const sameDosageForm =
        Boolean(original.dosageForm) &&
        Boolean(cand.dosageForm) &&
        original.dosageForm!.toLowerCase().trim() === cand.dosageForm!.toLowerCase().trim();

      return {
        id: cand.id,
        name: cand.name,
        genericName: cand.genericName,
        dosageForm: cand.dosageForm,
        strength: cand.strength,
        salePrice: candPrice,
        stockQty: totalStock,
        priceDifference,
        isCheaper: priceDifference > 0,
        sameDosageForm,
        batches: cand.batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          quantity: b.quantityInBaseUnits,
        })),
      };
    });

    // Sort substitutions: same dosage form first, then in-stock first, then highest savings
    substitutions.sort((a, b) => {
      if (a.sameDosageForm !== b.sameDosageForm) return a.sameDosageForm ? -1 : 1;
      if ((a.stockQty > 0) !== (b.stockQty > 0)) return a.stockQty > 0 ? -1 : 1;
      return b.priceDifference - a.priceDifference;
    });

    return {
      originalProduct: {
        id: original.id,
        name: original.name,
        genericName: original.genericName,
        dosageForm: original.dosageForm,
        strength: original.strength,
        salePrice: origPrice,
        stockQty: original.batches.reduce((sum, b) => sum + b.quantityInBaseUnits, 0),
      },
      hasGenericAlternatives: substitutions.length > 0,
      substitutions,
    };
  },

  /**
   * 6. DISPENSE PRESCRIPTION (PARTIAL OR FULL)
   * Supports:
   * - Verification requirement check
   * - Partial fills (quantity < remaining)
   * - Brand-to-generic substitution recording with reason
   * - Atomic FEFO batch allocation & immutable StockMovement creation
   * - Controlled drug register audit logging
   * - Status progression (PENDING -> VERIFIED -> PARTIALLY_DISPENSED -> FULLY_DISPENSED)
   */
  async dispensePrescription(
    scope: BranchScope,
    prescriptionId: string,
    data: DispensePrescriptionInput,
    pharmacist: { id: string; name: string }
  ) {
    const branchId = await resolveBranchId(scope);

    // Dispense inside an atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const rx = await tx.prescription.findFirst({
        where: { id: prescriptionId, pharmacyId: scope.pharmacyId },
        include: { items: true },
      });

      if (!rx) throw new NotFoundError("Prescription");

      if (rx.status === "PENDING") {
        throw new BadRequestError(
          "Prescription must be verified by a pharmacist before dispensing."
        );
      }
      if (rx.status === "FULLY_DISPENSED") {
        throw new BadRequestError("This prescription has already been fully dispensed.");
      }
      if (rx.status === "CANCELLED") {
        throw new BadRequestError("Cannot dispense a cancelled prescription.");
      }

      for (const dispenseItem of data.items) {
        const item = rx.items.find((i) => i.id === dispenseItem.prescriptionItemId);
        if (!item) {
          throw new BadRequestError(
            `Prescription item with ID '${dispenseItem.prescriptionItemId}' not found in this prescription.`
          );
        }

        if (dispenseItem.quantity <= 0) {
          throw new BadRequestError("Dispense quantity must be greater than zero.");
        }

        if (dispenseItem.quantity > item.quantityRemaining) {
          throw new BadRequestError(
            `Cannot dispense ${dispenseItem.quantity} units for '${item.prescribedDrugName}'. Only ${item.quantityRemaining} unit(s) remain to be dispensed.`
          );
        }

        // Retrieve product being dispensed
        const dispensedProduct = await tx.product.findFirst({
          where: { id: dispenseItem.dispensedProductId, pharmacyId: scope.pharmacyId },
        });

        if (!dispensedProduct) {
          throw new NotFoundError(`Dispensed product (${dispenseItem.dispensedProductId})`);
        }

        const isControlled =
          Boolean(item.isControlled) ||
          Boolean(dispensedProduct.isControlled) ||
          Boolean(dispensedProduct.schedule && dispensedProduct.schedule.trim() !== "");

        if (isControlled) {
          if (!rx.patientIdentifier || rx.patientIdentifier.trim() === "") {
            throw new BadRequestError(
              `Controlled medication '${dispensedProduct.name}' requires a patient identifier on the prescription.`
            );
          }
          if (!rx.doctorLicense || rx.doctorLicense.trim() === "") {
            throw new BadRequestError(
              `Controlled medication '${dispensedProduct.name}' requires doctor license credentials.`
            );
          }
        }

        const isSubstitution =
          Boolean(dispenseItem.isSubstitution) ||
          (Boolean(item.productId) && item.productId !== dispenseItem.dispensedProductId);

        if (isSubstitution && !dispenseItem.substitutionReason?.trim()) {
          dispenseItem.substitutionReason = "Generic bioequivalent substitution dispensed";
        }

        // ---------------------------------------------------------------------
        // Batch allocation & Stock Deduction (FEFO)
        // ---------------------------------------------------------------------
        let allocatedBatchId: string | null = null;
        let unitsNeeded = dispenseItem.quantity;

        if (dispenseItem.batchId) {
          // Specific batch selected by pharmacist
          const batch = await tx.batch.findFirst({
            where: {
              id: dispenseItem.batchId,
              pharmacyId: scope.pharmacyId,
              branchId,
              productId: dispensedProduct.id,
              status: "ACTIVE",
              isRecalled: false,
            },
          });

          if (!batch || batch.quantityInBaseUnits < unitsNeeded) {
            throw new BadRequestError(
              `Selected batch has insufficient stock (${batch?.quantityInBaseUnits ?? 0} available, ${unitsNeeded} needed).`
            );
          }

          const newBatchQty = batch.quantityInBaseUnits - unitsNeeded;
          await tx.batch.update({
            where: { id: batch.id },
            data: {
              quantityInBaseUnits: newBatchQty,
              status: newBatchQty === 0 ? "DEPLETED" : "ACTIVE",
            },
          });

          allocatedBatchId = batch.id;

          // Immutable StockMovement log
          await tx.stockMovement.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId,
              productId: dispensedProduct.id,
              batchId: batch.id,
              movementType: "PRESCRIPTION_DISPENSE",
              quantityDelta: -unitsNeeded,
              balanceAfter: Math.max(0, (dispensedProduct.stockQty ?? 0) - unitsNeeded),
              unitCost: batch.costPricePerUnit,
              referenceNumber: rx.prescriptionNumber,
              createdById: pharmacist.id,
            },
          });
        } else {
          // Automatic FEFO deduction
          const batches = await tx.batch.findMany({
            where: {
              pharmacyId: scope.pharmacyId,
              branchId,
              productId: dispensedProduct.id,
              status: "ACTIVE",
              quantityInBaseUnits: { gt: 0 },
              isRecalled: false,
            },
            orderBy: { expiryDate: "asc" }, // FEFO
          });

          const totalAvail = batches.reduce((sum, b) => sum + b.quantityInBaseUnits, 0);
          if (totalAvail < unitsNeeded) {
            throw new BadRequestError(
              `Insufficient stock for '${dispensedProduct.name}'. Available: ${totalAvail}, requested: ${unitsNeeded}.`
            );
          }

          for (const b of batches) {
            if (unitsNeeded <= 0) break;
            const take = Math.min(b.quantityInBaseUnits, unitsNeeded);
            const newBatchQty = b.quantityInBaseUnits - take;

            await tx.batch.update({
              where: { id: b.id },
              data: {
                quantityInBaseUnits: newBatchQty,
                status: newBatchQty === 0 ? "DEPLETED" : "ACTIVE",
              },
            });

            if (!allocatedBatchId) allocatedBatchId = b.id;

            await tx.stockMovement.create({
              data: {
                pharmacyId: scope.pharmacyId,
                branchId,
                productId: dispensedProduct.id,
                batchId: b.id,
                movementType: "PRESCRIPTION_DISPENSE",
                quantityDelta: -take,
                balanceAfter: Math.max(0, (dispensedProduct.stockQty ?? 0) - take),
                unitCost: b.costPricePerUnit,
                referenceNumber: rx.prescriptionNumber,
                createdById: pharmacist.id,
              },
            });

            unitsNeeded -= take;
          }
        }

        // Keep product.stockQty in sync
        await tx.product.update({
          where: { id: dispensedProduct.id },
          data: { stockQty: { decrement: dispenseItem.quantity } },
        });

        // ---------------------------------------------------------------------
        // Record Dispense History
        // ---------------------------------------------------------------------
        const isPartialFill = dispenseItem.quantity < item.quantityRemaining;

        const dispenseRecord = await tx.dispenseRecord.create({
          data: {
            prescriptionId: rx.id,
            prescriptionItemId: item.id,
            dispensedProductId: dispensedProduct.id,
            batchId: allocatedBatchId,
            quantity: dispenseItem.quantity,
            isPartialFill,
            isSubstitution,
            originalProductId: item.productId,
            substitutionReason: dispenseItem.substitutionReason ?? null,
            pharmacistId: pharmacist.id,
            pharmacistName: pharmacist.name,
            notes: dispenseItem.notes?.trim() ?? "",
          },
        });

        // ---------------------------------------------------------------------
        // Controlled-Drug Register Entry (if applicable)
        // ---------------------------------------------------------------------
        if (isControlled) {
          // Compute remaining active balance of this controlled product
          const activeBatches = await tx.batch.findMany({
            where: {
              productId: dispensedProduct.id,
              branchId,
              status: "ACTIVE",
            },
            select: { quantityInBaseUnits: true },
          });
          const balanceAfter = activeBatches.reduce((acc, b) => acc + b.quantityInBaseUnits, 0);

          await tx.controlledDrugRegister.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId,
              productId: dispensedProduct.id,
              batchId: allocatedBatchId,
              prescriptionId: rx.id,
              dispenseRecordId: dispenseRecord.id,
              patientName: rx.patientName,
              patientIdentifier: rx.patientIdentifier,
              doctorName: rx.doctorName,
              doctorLicense: rx.doctorLicense,
              transactionType: "DISPENSE",
              quantity: dispenseItem.quantity,
              balanceAfter,
              pharmacistId: pharmacist.id,
              pharmacistName: pharmacist.name,
              witnessName: dispenseItem.witnessName?.trim() ?? null,
              notes: dispenseItem.notes?.trim() ?? "",
            },
          });
        }

        // ---------------------------------------------------------------------
        // Update Prescription Item Quantity Remaining & Status
        // ---------------------------------------------------------------------
        const updatedDispensed = item.quantityDispensed + dispenseItem.quantity;
        const updatedRemaining = item.quantityRemaining - dispenseItem.quantity;
        const itemStatus = updatedRemaining === 0 ? "COMPLETED" : "PARTIAL";

        await tx.prescriptionItem.update({
          where: { id: item.id },
          data: {
            quantityDispensed: updatedDispensed,
            quantityRemaining: updatedRemaining,
            status: itemStatus,
          },
        });
      }

      // -----------------------------------------------------------------------
      // Evaluate overall prescription status
      // -----------------------------------------------------------------------
      const allItems = await tx.prescriptionItem.findMany({
        where: { prescriptionId: rx.id },
      });

      const allCompleted = allItems.every((i) => i.quantityRemaining === 0);
      const newStatus = allCompleted ? "FULLY_DISPENSED" : "PARTIALLY_DISPENSED";

      const finalRx = await tx.prescription.update({
        where: { id: rx.id },
        data: { status: newStatus },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          dispenseRecords: {
            orderBy: { dispensedAt: "desc" },
            include: {
              dispensedProduct: true,
              batch: true,
            },
          },
          controlledRegisters: true,
        },
      });

      return finalRx;
    });

    emitEvent("prescription:dispensed", result);
    return result;
  },

  /**
   * 7. CONTROLLED DRUG REGISTER REPORT
   */
  async getControlledDrugRegister(scope: BranchScope, query: ControlledRegisterQuery = {}) {
    const where: any = {
      pharmacyId: scope.pharmacyId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
    };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { patientName: { contains: s, mode: "insensitive" } },
        { patientIdentifier: { contains: s, mode: "insensitive" } },
        { doctorName: { contains: s, mode: "insensitive" } },
        { doctorLicense: { contains: s, mode: "insensitive" } },
        { pharmacistName: { contains: s, mode: "insensitive" } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.recordedAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    return prisma.controlledDrugRegister.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            genericName: true,
            dosageForm: true,
            strength: true,
            schedule: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
          },
        },
        prescription: {
          select: {
            id: true,
            prescriptionNumber: true,
            prescribedDate: true,
          },
        },
      },
    });
  },
};
