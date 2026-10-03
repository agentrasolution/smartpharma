import { z } from "zod";

export const OpenShiftSchema = z.object({
  openingCash: z.coerce.number().min(0, "Opening cash float cannot be negative").default(0),
  notes: z.string().optional().default(""),
});

export type OpenShiftInput = z.infer<typeof OpenShiftSchema>;

export const CashDropSchema = z.object({
  shiftId: z.string().min(1, "Shift ID is required"),
  type: z.enum(["DROP", "PAYOUT", "FLOAT_ADD"]).default("DROP"),
  amount: z.coerce.number().gt(0, "Amount must be greater than zero"),
  reason: z.string().min(1, "Reason is required"),
});

export type CashDropInput = z.infer<typeof CashDropSchema>;

export const CloseShiftSchema = z.object({
  shiftId: z.string().min(1, "Shift ID is required"),
  actualCash: z.coerce.number().min(0, "Actual counted cash cannot be negative"),
  closingNotes: z.string().optional().default(""),
});

export type CloseShiftInput = z.infer<typeof CloseShiftSchema>;

export const ListShiftsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  cashierId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ListShiftsQuery = z.infer<typeof ListShiftsQuerySchema>;
