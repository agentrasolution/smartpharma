import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  fatherName: z.string().optional().default(""),
  fatherPhone: z.string().optional().default(""),
  nationalId: z.string().optional().default(""),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().default(""),
  bloodGroup: z.string().optional().default(""),
  allergies: z.array(z.string()).optional().default([]),
  chronicConditions: z.array(z.string()).optional().default([]),
  emergencyContactName: z.string().optional().default(""),
  emergencyContactPhone: z.string().optional().default(""),
  creditLimit: z.number().optional().default(0),
  allowCredit: z.boolean().optional().default(true),
  notes: z.string().optional().default(""),
  consentGiven: z.boolean().optional().default(false),
  consentDate: z.string().optional().nullable(),
  consentNotes: z.string().optional().default(""),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createChronicMedicationSchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().optional().nullable(),
  medicationName: z.string().min(1),
  dosage: z.string().optional().default(""),
  frequency: z.string().optional().default(""),
  daysSupply: z.number().int().positive().optional().default(30),
  lastDispensedDate: z.string().optional(),
  nextRefillDate: z.string().optional(),
  reminderActive: z.boolean().optional().default(true),
  notes: z.string().optional().default(""),
});

export const updateChronicMedicationSchema = z.object({
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  daysSupply: z.number().int().positive().optional(),
  reminderActive: z.boolean().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "DISCONTINUED"]).optional(),
  nextRefillDate: z.string().optional(),
  notes: z.string().optional(),
});

export const recordContactSchema = z.object({
  notes: z.string().min(1),
});

export const recordRefillSchema = z.object({
  dispensedDate: z.string().optional(),
  daysSupply: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateChronicMedicationInput = z.infer<typeof createChronicMedicationSchema>;
export type UpdateChronicMedicationInput = z.infer<typeof updateChronicMedicationSchema>;
export type RecordContactInput = z.infer<typeof recordContactSchema>;
export type RecordRefillInput = z.infer<typeof recordRefillSchema>;
