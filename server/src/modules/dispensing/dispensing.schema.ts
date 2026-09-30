import { z } from "zod";

export const prescriptionItemInputSchema = z.object({
  prescribedDrugName: z.string().min(1, "Prescribed drug name is required"),
  productId: z.string().optional().nullable(),
  dosage: z.string().optional().default(""),
  frequency: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  instructions: z.string().optional().default(""),
  quantityPrescribed: z.number().int().positive("Prescribed quantity must be greater than zero"),
  isControlled: z.boolean().optional().default(false),
});

export const createPrescriptionSchema = z.object({
  prescriptionNumber: z.string().optional(),
  patientName: z.string().min(1, "Patient name is required"),
  patientIdentifier: z.string().optional().default(""), // National ID / Iqama / Passport / Phone
  patientPhone: z.string().optional().default(""),
  patientAge: z.number().int().min(0).max(150).optional().nullable(),
  patientGender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  doctorName: z.string().min(1, "Doctor name is required"),
  doctorLicense: z.string().optional().default(""),
  clinicOrHospital: z.string().optional().default(""),
  diagnosis: z.string().optional().default(""),
  prescribedDate: z.string().optional(),
  notes: z.string().optional().default(""),
  items: z.array(prescriptionItemInputSchema).min(1, "At least one medication is required"),
});

export const verifyPrescriptionSchema = z.object({
  verified: z.boolean().default(true),
  notes: z.string().optional().default(""),
});

export const dispenseItemInputSchema = z.object({
  prescriptionItemId: z.string().min(1, "Prescription item ID is required"),
  dispensedProductId: z.string().min(1, "Dispensed product ID is required"),
  batchId: z.string().optional().nullable(),
  quantity: z.number().int().positive("Quantity to dispense must be at least 1"),
  isSubstitution: z.boolean().optional().default(false),
  substitutionReason: z.string().optional().nullable(),
  notes: z.string().optional().default(""),
  witnessName: z.string().optional().nullable(),
});

export const dispensePrescriptionSchema = z.object({
  items: z.array(dispenseItemInputSchema).min(1, "At least one item must be dispensed"),
  notes: z.string().optional().default(""),
});

export const listPrescriptionsQuerySchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "PARTIALLY_DISPENSED", "FULLY_DISPENSED", "CANCELLED", "ALL"]).optional(),
  search: z.string().optional(),
  patientIdentifier: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const controlledRegisterQuerySchema = z.object({
  productId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export type PrescriptionItemInput = z.infer<typeof prescriptionItemInputSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type VerifyPrescriptionInput = z.infer<typeof verifyPrescriptionSchema>;
export type DispenseItemInput = z.infer<typeof dispenseItemInputSchema>;
export type DispensePrescriptionInput = z.infer<typeof dispensePrescriptionSchema>;
export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsQuerySchema>;
export type ControlledRegisterQuery = z.infer<typeof controlledRegisterQuerySchema>;
