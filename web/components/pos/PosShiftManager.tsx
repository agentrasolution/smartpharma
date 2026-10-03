"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound,
  Store,
  DollarSign,
  ArrowDownUp,
  FileSpreadsheet,
  Lock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Coins,
  RefreshCw,
  PlusCircle,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { PosShift, CashDrop, XReportData, ZReportData } from "@/types";

interface PosShiftManagerProps {
  activeShift: PosShift | null | undefined;
  isLoading?: boolean;
}

export default function PosShiftManager({ activeShift, isLoading }: PosShiftManagerProps) {
  const queryClient = useQueryClient();

  // Dialog open states
  const [openShiftDialogOpen, setOpenShiftDialogOpen] = useState(false);
  const [cashDropDialogOpen, setCashDropDialogOpen] = useState(false);
  const [xReportDialogOpen, setXReportDialogOpen] = useState(false);
  const [closeShiftDialogOpen, setCloseShiftDialogOpen] = useState(false);
  const [zReportResultModalOpen, setZReportResultModalOpen] = useState(false);
  const [completedZReport, setCompletedZReport] = useState<ZReportData | null>(null);

  // Form states - Open Shift
  const [openingFloat, setOpeningFloat] = useState("500");
  const [openNotes, setOpenNotes] = useState("");

  // Form states - Cash Movement (Drop / Payout / Float Add)
  const [movementType, setMovementType] = useState<"DROP" | "PAYOUT" | "FLOAT_ADD">("DROP");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");

  // Form states - Close Shift
  const [actualCashInput, setActualCashInput] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  // Live X-Report Query (fetches real-time mid-shift reading when modal opens)
  const xReportQuery = useQuery({
    queryKey: ["shift-x-report", activeShift?.id],
    queryFn: () => (activeShift?.id ? api.shifts.getXReport(activeShift.id) : null),
    enabled: Boolean(activeShift?.id && (xReportDialogOpen || closeShiftDialogOpen)),
    staleTime: 0,
  });

  // Open Shift Mutation
  const openShiftMutation = useMutation({
    mutationFn: (data: { openingCash: number; notes?: string }) => api.shifts.open(data),
    onSuccess: (newShift) => {
      queryClient.invalidateQueries({ queryKey: ["active-shift"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setOpenShiftDialogOpen(false);
      setOpeningFloat("500");
      setOpenNotes("");
      toast.success(`Shift #${newShift.shiftNumber} opened successfully!`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to open shift");
    },
  });

  // Cash Movement Mutation
  const cashDropMutation = useMutation({
    mutationFn: (data: { shiftId: string; type: "DROP" | "PAYOUT" | "FLOAT_ADD"; amount: number; reason: string }) =>
      api.shifts.drop(data),
    onSuccess: (drop) => {
      queryClient.invalidateQueries({ queryKey: ["active-shift"] });
      queryClient.invalidateQueries({ queryKey: ["shift-x-report"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setCashDropDialogOpen(false);
      setMovementAmount("");
      setMovementReason("");
      const labels = {
        DROP: "Safe drop recorded",
        PAYOUT: "Petty cash payout recorded",
        FLOAT_ADD: "Cash float added to drawer",
      };
      toast.success(labels[drop.type] || "Cash movement recorded");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to record cash movement");
    },
  });

  // Close Shift Mutation
  const closeShiftMutation = useMutation({
    mutationFn: (data: { shiftId: string; actualCash: number; closingNotes?: string }) =>
      api.shifts.close(data),
    onSuccess: async (zReport) => {
      queryClient.invalidateQueries({ queryKey: ["active-shift"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setCloseShiftDialogOpen(false);
      setActualCashInput("");
      setClosingNotes("");
      setCompletedZReport(zReport);
      setZReportResultModalOpen(true);
      toast.success(`Shift #${zReport.shiftNumber} closed successfully!`);

      // Automatically trigger 80mm Z-Report print
      if (typeof window.printZReport === "function") {
        try {
          await window.printZReport(zReport);
        } catch {
          // ignore auto-print failure
        }
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to close shift");
    },
  });

  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(openingFloat);
    if (isNaN(val) || val < 0) {
      toast.error("Please enter a valid opening float amount");
      return;
    }
    openShiftMutation.mutate({ openingCash: val, notes: openNotes.trim() });
  };

  const handleCashMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) return;
    const amount = parseFloat(movementAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }
    if (!movementReason.trim()) {
      toast.error("Please provide a reason / reference for this movement");
      return;
    }
    cashDropMutation.mutate({
      shiftId: activeShift.id,
      type: movementType,
      amount,
      reason: movementReason.trim(),
    });
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) return;
    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) {
      toast.error("Please enter the physical cash counted in drawer");
      return;
    }
    closeShiftMutation.mutate({
      shiftId: activeShift.id,
      actualCash: actual,
      closingNotes: closingNotes.trim(),
    });
  };

  const handlePrintXReport = async () => {
    if (!xReportQuery.data) return;
    if (typeof window.printXReport === "function") {
      const res = await window.printXReport(xReportQuery.data);
      if (res?.success) {
        toast.success("X-Report sent to printer");
      } else {
        toast.error(res?.error || "Failed to print X-Report");
      }
    } else {
      toast.error("Printer interface not available");
    }
  };

  const handlePrintZReport = async () => {
    if (!completedZReport) return;
    if (typeof window.printZReport === "function") {
      const res = await window.printZReport(completedZReport);
      if (res?.success) {
        toast.success("Z-Report sent to printer");
      } else {
        toast.error(res?.error || "Failed to print Z-Report");
      }
    } else {
      toast.error("Printer interface not available");
    }
  };

  // Variance calculation for close shift modal
  const liveExpected = xReportQuery.data?.cashDrawerSummary?.expectedCashInDrawer ?? activeShift?.expectedCash ?? 0;
  const countedNum = parseFloat(actualCashInput || "0");
  const variance = !isNaN(countedNum) ? countedNum - liveExpected : 0;
  const varianceStatus = Math.abs(variance) < 0.01 ? "BALANCED" : variance > 0 ? "OVER" : "SHORT";

  return (
    <>
      {/* 1. Closed Register Notice Banner (when no shift is active) */}
      {!activeShift && !isLoading && (
        <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-xs sm:text-sm">Register Closed — Shift Required</div>
              <div className="text-[11px] sm:text-xs text-amber-700/80 dark:text-amber-300/80">
                Please open a shift with an initial cash float before ringing up sales transactions.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpenShiftDialogOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-amber-950 font-medium text-xs shadow-xs h-8 px-3.5 shrink-0 rounded-lg"
          >
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            Open Register / Start Shift
          </Button>
        </div>
      )}

      {/* 2. Active Shift Header Status Bar (compact, modern) */}
      {activeShift && (
        <div className="flex items-center justify-between gap-2 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary shrink-0 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold">Shift #{activeShift.shiftNumber}</span>
              <span className="text-text-secondary">({activeShift.cashierName})</span>
            </div>

            <div className="h-3 w-[1px] bg-border hidden sm:block" />

            <div className="text-text-secondary hidden md:flex items-center gap-3">
              <span>
                Float: <strong className="text-text-primary font-mono">{formatCurrency(activeShift.openingCash)}</strong>
              </span>
              <span>
                Cash Sales: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(activeShift.totalCashSales)}</strong>
              </span>
              <span>
                Card: <strong className="text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(activeShift.totalCardSales)}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cash Drop / Movement Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMovementType("DROP");
                setMovementAmount("");
                setMovementReason("");
                setCashDropDialogOpen(true);
              }}
              className="h-7 px-2.5 text-xs border-border hover:bg-surface-hover gap-1"
              title="Cash Movement: Safe Drop, Petty Cash Payout, or Float Addition"
            >
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>Cash Drop / Out</span>
            </Button>

            {/* Live X-Report Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                xReportQuery.refetch();
                setXReportDialogOpen(true);
              }}
              className="h-7 px-2.5 text-xs border-border hover:bg-surface-hover gap-1"
              title="Mid-shift live audit reading"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
              <span>X-Report</span>
            </Button>

            {/* End Shift & Z-Report Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                xReportQuery.refetch();
                setActualCashInput("");
                setClosingNotes("");
                setCloseShiftDialogOpen(true);
              }}
              className="h-7 px-2.5 text-xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 gap-1 font-medium"
              title="Reconcile drawer and close register"
            >
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <span>Close Register (Z)</span>
            </Button>
          </div>
        </div>
      )}

      {/* MODAL 1: OPEN SHIFT */}
      <Dialog open={openShiftDialogOpen} onOpenChange={setOpenShiftDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <KeyRound className="w-5 h-5" />
              <DialogTitle>Open Register / Start Shift</DialogTitle>
            </div>
            <DialogDescription>
              Record the opening cash drawer float to begin ringing up sales and tracking cash reconciliation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOpenShiftSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="opening-float">Opening Cash Float (SAR)</Label>
              <div className="relative">
                <Input
                  id="opening-float"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="font-mono text-base font-semibold pr-14"
                  placeholder="0.00"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 text-xs text-text-secondary font-medium">SAR</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[0, 200, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOpeningFloat(String(preset))}
                    className="px-2 py-0.5 text-[11px] rounded border border-border hover:bg-surface-hover transition-colors font-mono"
                  >
                    {preset === 0 ? "0 (Zero Float)" : `${preset} SAR`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="open-notes">Opening Notes (Optional)</Label>
              <Input
                id="open-notes"
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="e.g. Morning shift, 500 SAR in small change"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenShiftDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={openShiftMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {openShiftMutation.isPending ? "Opening..." : "Confirm & Open Register"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CASH MOVEMENTS (DROP / PAYOUT / FLOAT_ADD) */}
      <Dialog open={cashDropDialogOpen} onOpenChange={setCashDropDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Coins className="w-5 h-5" />
              <DialogTitle>Register Cash Drawer Movement</DialogTitle>
            </div>
            <DialogDescription>
              Record cash removed from or added to the active register drawer during this shift.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCashMovementSubmit} className="space-y-4 py-2">
            <Tabs value={movementType} onValueChange={(v) => setMovementType(v as any)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="DROP" className="text-xs">
                  <ArrowDownRight className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  Safe Drop
                </TabsTrigger>
                <TabsTrigger value="PAYOUT" className="text-xs">
                  <ArrowDownRight className="w-3.5 h-3.5 mr-1 text-rose-500" />
                  Petty Payout
                </TabsTrigger>
                <TabsTrigger value="FLOAT_ADD" className="text-xs">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  Add Float
                </TabsTrigger>
              </TabsList>

              <div className="mt-3 p-2.5 rounded-lg bg-surface border border-border text-[11px] text-text-secondary">
                {movementType === "DROP" && (
                  <span>
                    <strong>Safe Drop:</strong> Transfer excess cash from the drawer into the pharmacy safe to minimize register liability.
                  </span>
                )}
                {movementType === "PAYOUT" && (
                  <span>
                    <strong>Petty Cash Payout:</strong> Record an authorized store expense paid directly in cash from the drawer (e.g. courier, tea, supplies).
                  </span>
                )}
                {movementType === "FLOAT_ADD" && (
                  <span>
                    <strong>Add Float:</strong> Replenish drawer cash or add extra change from the safe during high-volume periods.
                  </span>
                )}
              </div>
            </Tabs>

            <div className="space-y-1.5">
              <Label htmlFor="movement-amount">Amount (SAR)</Label>
              <div className="relative">
                <Input
                  id="movement-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="font-mono text-base font-semibold pr-14"
                  placeholder="0.00"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 text-xs text-text-secondary font-medium">SAR</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[50, 100, 200, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMovementAmount(String(preset))}
                    className="px-2 py-0.5 text-[11px] rounded border border-border hover:bg-surface-hover transition-colors font-mono"
                  >
                    {preset} SAR
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="movement-reason">Reason / Reference (Required)</Label>
              <Input
                id="movement-reason"
                type="text"
                required
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder={
                  movementType === "DROP"
                    ? "e.g. Excess cash drop to safe bag #042"
                    : movementType === "PAYOUT"
                    ? "e.g. Courier delivery payment, Receipt #89"
                    : "e.g. Additional 1 SAR and 5 SAR coins from safe"
                }
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCashDropDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={cashDropMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {cashDropMutation.isPending ? "Recording..." : "Record Movement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: LIVE X-REPORT AUDIT */}
      <Dialog open={xReportDialogOpen} onOpenChange={setXReportDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <FileSpreadsheet className="w-5 h-5" />
                <DialogTitle>Mid-Shift X-Report Reading</DialogTitle>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase border-blue-500/30 text-blue-600 dark:text-blue-400">
                Live Audit
              </Badge>
            </div>
            <DialogDescription>
              Real-time snapshot of sales, tender types, and cash movements without closing the register.
            </DialogDescription>
          </DialogHeader>

          {xReportQuery.isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-secondary text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span>Calculating live drawer balance...</span>
            </div>
          ) : xReportQuery.data ? (
            <div className="space-y-4 py-2 text-xs">
              {/* Meta details */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-surface border border-border rounded-lg text-[11px]">
                <div>
                  <span className="text-text-secondary">Shift #:</span>{" "}
                  <strong>{xReportQuery.data.shiftNumber}</strong>
                </div>
                <div>
                  <span className="text-text-secondary">Cashier:</span>{" "}
                  <strong>{xReportQuery.data.cashierName}</strong>
                </div>
                <div>
                  <span className="text-text-secondary">Branch:</span>{" "}
                  <strong>{xReportQuery.data.branchName}</strong>
                </div>
                <div>
                  <span className="text-text-secondary">Opened:</span>{" "}
                  <strong>{new Date(xReportQuery.data.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
                </div>
              </div>

              {/* Sales breakdown */}
              <div className="space-y-2 p-3 bg-surface border border-border rounded-lg">
                <div className="font-semibold text-text-primary text-[11px] uppercase tracking-wider text-text-secondary">
                  Sales Tender Summary ({xReportQuery.data.salesSummary.totalTransactions} Invoices)
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between py-0.5">
                    <span className="text-text-secondary">Cash Sales:</span>
                    <span className="font-mono font-medium">{formatCurrency(xReportQuery.data.salesSummary.cashSales.amount)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-text-secondary">Card / Mada Sales:</span>
                    <span className="font-mono font-medium">{formatCurrency(xReportQuery.data.salesSummary.cardSales.amount)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-text-secondary">Credit / Insurance:</span>
                    <span className="font-mono font-medium">{formatCurrency(xReportQuery.data.salesSummary.creditSales.amount)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t border-border font-semibold text-text-primary">
                    <span>Gross Sales:</span>
                    <span className="font-mono text-accent">{formatCurrency(xReportQuery.data.salesSummary.grossSales)}</span>
                  </div>
                </div>
              </div>

              {/* Cash Drawer Reconciliation */}
              <div className="space-y-2 p-3 bg-surface border border-border rounded-lg">
                <div className="font-semibold text-text-primary text-[11px] uppercase tracking-wider text-text-secondary">
                  Cash Drawer Movements
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between py-0.5">
                    <span className="text-text-secondary">Opening Float:</span>
                    <span className="font-mono font-medium">{formatCurrency(xReportQuery.data.openingCash)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-emerald-600 dark:text-emerald-400">
                    <span>+ Cash Sales:</span>
                    <span className="font-mono font-medium">+{formatCurrency(xReportQuery.data.salesSummary.cashSales.amount)}</span>
                  </div>
                  {xReportQuery.data.cashMovements.floatAdds.total > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-600 dark:text-emerald-400">
                      <span>+ Float Added:</span>
                      <span className="font-mono font-medium">+{formatCurrency(xReportQuery.data.cashMovements.floatAdds.total)}</span>
                    </div>
                  )}
                  {xReportQuery.data.returnsSummary.cashRefunds > 0 && (
                    <div className="flex justify-between py-0.5 text-rose-500">
                      <span>- Cash Refunds Paid:</span>
                      <span className="font-mono font-medium">-{formatCurrency(xReportQuery.data.returnsSummary.cashRefunds)}</span>
                    </div>
                  )}
                  {xReportQuery.data.cashMovements.dropsToSafe.total > 0 && (
                    <div className="flex justify-between py-0.5 text-rose-500">
                      <span>- Safe Drops:</span>
                      <span className="font-mono font-medium">-{formatCurrency(xReportQuery.data.cashMovements.dropsToSafe.total)}</span>
                    </div>
                  )}
                  {xReportQuery.data.cashMovements.payouts.total > 0 && (
                    <div className="flex justify-between py-0.5 text-rose-500">
                      <span>- Petty Payouts:</span>
                      <span className="font-mono font-medium">-{formatCurrency(xReportQuery.data.cashMovements.payouts.total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 border-t border-border font-bold text-sm bg-accent/5 px-2 rounded mt-1">
                    <span className="text-accent">Live Expected Drawer Cash:</span>
                    <span className="font-mono text-accent">
                      {formatCurrency(xReportQuery.data.cashDrawerSummary.expectedCashInDrawer)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-text-secondary text-xs">Could not load report</div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setXReportDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handlePrintXReport}
              disabled={!xReportQuery.data}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print 80mm X-Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CLOSE REGISTER (Z-REPORT) */}
      <Dialog open={closeShiftDialogOpen} onOpenChange={setCloseShiftDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Lock className="w-5 h-5" />
              <DialogTitle>Close Register & Reconcile (Z-Report)</DialogTitle>
            </div>
            <DialogDescription>
              Count physical cash in the drawer. SmartPharma reconciles totals and produces an immutable Z-Report.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCloseShiftSubmit} className="space-y-4 py-2">
            {/* Live expected display */}
            <div className="p-3 bg-surface border border-border rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-text-secondary block text-[11px]">System Expected Cash:</span>
                <span className="font-mono font-bold text-base text-text-primary">
                  {formatCurrency(liveExpected)}
                </span>
              </div>
              <Badge variant="outline" className="border-border text-text-secondary">
                Shift #{activeShift?.shiftNumber}
              </Badge>
            </div>

            {/* Actual counted input */}
            <div className="space-y-1.5">
              <Label htmlFor="actual-cash" className="font-semibold">
                Actual Physical Cash Counted (SAR)
              </Label>
              <div className="relative">
                <Input
                  id="actual-cash"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="font-mono text-lg font-bold pr-14 text-emerald-600 dark:text-emerald-400"
                  placeholder="0.00"
                  autoFocus
                />
                <span className="absolute right-3 top-3 text-xs text-text-secondary font-medium">SAR</span>
              </div>
            </div>

            {/* Real-time Variance Status Card */}
            {actualCashInput && !isNaN(countedNum) && (
              <div
                className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                  varianceStatus === "BALANCED"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : varianceStatus === "OVER"
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {varianceStatus === "BALANCED" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle
                      className={`w-5 h-5 shrink-0 ${varianceStatus === "OVER" ? "text-blue-600" : "text-rose-600"}`}
                    />
                  )}
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wider">
                      {varianceStatus === "BALANCED"
                        ? "Register Balanced"
                        : varianceStatus === "OVER"
                        ? "Drawer Over"
                        : "Drawer Short"}
                    </div>
                    <div className="text-[11px] opacity-80">
                      {varianceStatus === "BALANCED"
                        ? "Physical count exactly matches system expected cash."
                        : varianceStatus === "OVER"
                        ? "Cash in drawer exceeds system calculation."
                        : "Cash in drawer is less than system calculation."}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-text-secondary">Variance</div>
                  <div className="font-mono font-bold text-sm">
                    {variance > 0 ? "+" : ""}
                    {formatCurrency(variance)}
                  </div>
                </div>
              </div>
            )}

            {/* Closing notes */}
            <div className="space-y-1.5">
              <Label htmlFor="close-notes">Handover Notes / Discrepancy Reason</Label>
              <Textarea
                id="close-notes"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="e.g. Handed over to evening cashier Ahmed, drawer verified balanced."
                rows={2}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCloseShiftDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={closeShiftMutation.isPending || !actualCashInput}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                {closeShiftMutation.isPending ? "Closing..." : "Confirm & Finalize Z-Report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: Z-REPORT COMPLETED SUMMARY */}
      <Dialog open={zReportResultModalOpen} onOpenChange={setZReportResultModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              <DialogTitle>Z-Report Generated Successfully</DialogTitle>
            </div>
            <DialogDescription>
              Shift #{completedZReport?.shiftNumber} has been officially closed and locked.
            </DialogDescription>
          </DialogHeader>

          {completedZReport && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-surface border border-border rounded-lg space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Cashier:</span>
                  <span className="font-medium">{completedZReport.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Invoices:</span>
                  <span className="font-mono font-medium">{completedZReport.salesSummary?.totalTransactions ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Gross Sales:</span>
                  <span className="font-mono font-bold">{formatCurrency(completedZReport.salesSummary?.grossSales ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Expected Cash:</span>
                  <span className="font-mono">{formatCurrency(completedZReport.cashDrawerSummary?.expectedCashInDrawer ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Actual Counted:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(completedZReport.actualCash)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="text-text-secondary">Reconciliation Status:</span>
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] ${
                      completedZReport.varianceStatus === "BALANCED"
                        ? "border-emerald-500/30 text-emerald-600"
                        : completedZReport.varianceStatus === "OVER"
                        ? "border-blue-500/30 text-blue-600"
                        : "border-rose-500/30 text-rose-600"
                    }`}
                  >
                    {completedZReport.varianceStatus} ({formatCurrency(completedZReport.cashVariance)})
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={handlePrintZReport}
              className="gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Re-Print 80mm Z-Report
            </Button>
            <Button
              onClick={() => {
                setZReportResultModalOpen(false);
                setCompletedZReport(null);
                setOpenShiftDialogOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Open New Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
