import { z } from "zod";

export const updatePharmacySchema = z.object({
  name: z.string().min(1).optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

export const updateSubscriptionSchema = z.object({
  status: z.enum(["trial", "active", "past_due", "cancelled", "expired"]).optional(),
  plan: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  extendMonths: z.number().int().min(1).max(24).optional(),
  renewsAt: z.string().datetime().optional(),
});

export type UpdatePharmacyInput = z.infer<typeof updatePharmacySchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;