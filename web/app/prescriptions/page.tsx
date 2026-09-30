"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { PortalNav } from "@/components/portal-nav";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type {
  Prescription,
  PrescriptionItem,
  ControlledDrugRegister,
  SubstitutionSuggestionResult,
  Product,
} from "@/types";
import {
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Plus,
  ShieldAlert,
  ArrowRightLeft,
  Clock,
  UserCheck,
  Stethoscope,
  User,
  Calendar,
  Phone,
} from "lucide-react";

export default function PrescriptionsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // State
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [controlledLogs, setControlledLogs] = useState<ControlledDrugRegister[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"queue" | "register">("queue");

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [registerSearch, setRegisterSearch] = useState("");

  // Create Prescription Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submittingRx, setSubmittingRx] = useState(false);
  const [newRx, setNewRx] = useState({
    patientName: "",
    patientIdentifier: "",
    patientPhone: "",
    patientAge: "",
    patientGender: "OTHER",
    doctorName: "",
    doctorLicense: "",
    clinicOrHospital: "",
    diagnosis: "",
    notes: "",
    items: [
      {
        prescribedDrugName: "",
        productId: "",
        dosage: "",
        frequency: "1-0-1 after food",
        duration: "5 days",
        instructions: "Take with water after meals",
        quantityPrescribed: 10,
        isControlled: false,
      },
    ],
  });

  // Selected Rx Detail Modal
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Dispense Item Modal
  const [dispenseModalOpen, setDispenseModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<PrescriptionItem | null>(null);
  const [dispenseQty, setDispenseQty] = useState(1);
  const [dispensedProductId, setDispensedProductId] = useState("");
  const [isSubstitution, setIsSubstitution] = useState(false);
  const [substitutionReason, setSubstitutionReason] = useState("");
  const [dispenseNotes, setDispenseNotes] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [substitutions, setSubstitutions] = useState<SubstitutionSuggestionResult | null>(null);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [dispensing, setDispensing] = useState(false);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auth Guard
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      const [rxRes, regRes, prodRes] = await Promise.all([
        api.prescriptions.list({
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: search || undefined,
        }),
        api.prescriptions.controlledRegister({
          search: registerSearch || undefined,
        }),
        api.products.list({ pageSize: 100 }),
      ]);
      setPrescriptions(rxRes || []);
      setControlledLogs(regRes || []);
      const pList: Product[] = Array.isArray(prodRes) ? prodRes : (prodRes as { data?: Product[] })?.data ?? [];
      setProducts(pList);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Failed to load prescription data:", e);
      setFeedback({ type: "error", text: e.message || "Failed to load prescriptions." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, search, registerSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Auto-clear feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Refresh
  function handleRefresh() {
    setRefreshing(true);
    loadData();
  }

  // Create Prescription Handlers
  function handleAddItemRow() {
    setNewRx((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          prescribedDrugName: "",
          productId: "",
          dosage: "",
          frequency: "1-0-1 after food",
          duration: "5 days",
          instructions: "",
          quantityPrescribed: 10,
          isControlled: false,
        },
      ],
    }));
  }

  function handleRemoveItemRow(idx: number) {
    if (newRx.items.length <= 1) return;
    setNewRx((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }

  async function handleCreateRx(e: React.FormEvent) {
    e.preventDefault();
    if (!newRx.patientName.trim()) {
      setFeedback({ type: "error", text: "Patient name is required." });
      return;
    }
    if (!newRx.doctorName.trim()) {
      setFeedback({ type: "error", text: "Doctor name is required." });
      return;
    }

    const hasControlled = newRx.items.some((i) => i.isControlled);
    if (hasControlled) {
      if (!newRx.patientIdentifier.trim()) {
        setFeedback({
          type: "error",
          text: "Controlled medications require a Patient Identifier (National ID / Iqama / Passport).",
        });
        return;
      }
      if (!newRx.doctorLicense.trim()) {
        setFeedback({
          type: "error",
          text: "Controlled medications require Prescribing Doctor License credentials.",
        });
        return;
      }
    }

    setSubmittingRx(true);
    try {
      await api.prescriptions.create({
        ...newRx,
        patientAge: newRx.patientAge ? parseInt(newRx.patientAge, 10) : null,
        items: newRx.items.map((i) => ({
          ...i,
          productId: i.productId || null,
          quantityPrescribed: Number(i.quantityPrescribed),
        })),
      });
      setFeedback({ type: "success", text: "Prescription captured successfully!" });
      setCreateModalOpen(false);
      resetCreateForm();
      loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setFeedback({ type: "error", text: e.message || "Failed to create prescription." });
    } finally {
      setSubmittingRx(false);
    }
  }

  function resetCreateForm() {
    setNewRx({
      patientName: "",
      patientIdentifier: "",
      patientPhone: "",
      patientAge: "",
      patientGender: "OTHER",
      doctorName: "",
      doctorLicense: "",
      clinicOrHospital: "",
      diagnosis: "",
      notes: "",
      items: [
        {
          prescribedDrugName: "",
          productId: "",
          dosage: "",
          frequency: "1-0-1 after food",
          duration: "5 days",
          instructions: "Take with water after meals",
          quantityPrescribed: 10,
          isControlled: false,
        },
      ],
    });
  }

  // Pharmacist Verification
  async function handleVerifyRx() {
    if (!selectedRx) return;
    setVerifying(true);
    try {
      const updated = await api.prescriptions.verify(selectedRx.id, {
        verified: true,
        notes: verificationNotes,
      });
      setSelectedRx(updated);
      setFeedback({ type: "success", text: "Prescription verified and authorized for dispensing." });
      loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setFeedback({ type: "error", text: e.message || "Verification failed." });
    } finally {
      setVerifying(false);
    }
  }

  // Dispense Dialog Setup
  async function openDispenseDialog(item: PrescriptionItem) {
    setActiveItem(item);
    setDispenseQty(item.quantityRemaining);
    setDispensedProductId(item.productId || "");
    setIsSubstitution(false);
    setSubstitutionReason("");
    setDispenseNotes("");
    setWitnessName("");
    setSubstitutions(null);

    if (item.productId) {
      setLoadingSubs(true);
      try {
        const subs = await api.prescriptions.suggestSubstitutions(item.productId);
        setSubstitutions(subs);
      } catch (err) {
        console.error("Failed to load substitutions:", err);
      } finally {
        setLoadingSubs(false);
      }
    }

    setDispenseModalOpen(true);
  }

  async function handleConfirmDispense() {
    if (!selectedRx || !activeItem) return;
    if (dispenseQty <= 0) {
      setFeedback({ type: "error", text: "Dispense quantity must be greater than zero." });
      return;
    }
    if (dispenseQty > activeItem.quantityRemaining) {
      setFeedback({
        type: "error",
        text: `Cannot dispense more than remaining quantity (${activeItem.quantityRemaining}).`,
      });
      return;
    }
    if (!dispensedProductId) {
      setFeedback({ type: "error", text: "Please select an inventory product to dispense." });
      return;
    }

    setDispensing(true);
    try {
      const updated = await api.prescriptions.dispense(selectedRx.id, {
        items: [
          {
            prescriptionItemId: activeItem.id,
            dispensedProductId,
            quantity: dispenseQty,
            isSubstitution,
            substitutionReason: isSubstitution ? substitutionReason : null,
            notes: dispenseNotes,
            witnessName: witnessName || null,
          },
        ],
      });
      setSelectedRx(updated);
      setDispenseModalOpen(false);
      setFeedback({ type: "success", text: "Medication successfully dispensed and stock allocated." });
      loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setFeedback({ type: "error", text: e.message || "Failed to dispense medication." });
    } finally {
      setDispensing(false);
    }
  }

  // Calculations
  const pendingCount = prescriptions.filter((r) => r.status === "PENDING").length;
  const verifiedCount = prescriptions.filter((r) => r.status === "VERIFIED").length;
  const partialCount = prescriptions.filter((r) => r.status === "PARTIALLY_DISPENSED").length;
  const fullyDispensedCount = prescriptions.filter((r) => r.status === "FULLY_DISPENSED").length;

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">
      <PortalNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Dispensing & Prescriptions
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                Pillar E
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-1">
              Clinical prescription capture, pharmacist verification, generic bioequivalent substitution & controlled register.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 shadow-sm transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Capture Prescription
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "p-3 rounded-lg border text-xs flex items-center justify-between",
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              )}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button onClick={() => setFeedback(null)}>
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-medium">Pending Review</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-500 mt-2">{pendingCount}</p>
            <p className="text-[11px] text-text-secondary mt-0.5">Awaiting Pharmacist</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-medium">Verified & Ready</span>
              <UserCheck className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-500 mt-2">{verifiedCount}</p>
            <p className="text-[11px] text-text-secondary mt-0.5">Authorized for Dispense</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-medium">Partially Dispensed</span>
              <ArrowRightLeft className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-500 mt-2">{partialCount}</p>
            <p className="text-[11px] text-text-secondary mt-0.5">Partial Fills Active</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-medium">Fully Dispensed</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-500 mt-2">{fullyDispensedCount}</p>
            <p className="text-[11px] text-text-secondary mt-0.5">Completed Workflows</p>
          </div>
        </div>

        {/* Sub-Nav Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-px">
          <button
            onClick={() => setActiveTab("queue")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all",
              activeTab === "queue"
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            <FileText className="h-4 w-4" />
            Prescriptions Queue ({prescriptions.length})
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all",
              activeTab === "register"
                ? "border-rose-500 text-rose-500"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            Controlled Drugs Register ({controlledLogs.length})
          </button>
        </div>

        {/* PRESCRIPTION QUEUE TAB */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search Rx#, Patient, Doctor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Verification</option>
                  <option value="VERIFIED">Verified & Ready</option>
                  <option value="PARTIALLY_DISPENSED">Partially Dispensed</option>
                  <option value="FULLY_DISPENSED">Fully Dispensed</option>
                </select>
              </div>
            </div>

            {/* Prescriptions Table */}
            <div className="border border-border rounded-xl bg-surface overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-2/60 border-b border-border text-text-secondary font-medium">
                    <tr>
                      <th className="py-3 px-4">Rx Number</th>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Prescriber</th>
                      <th className="py-3 px-4">Medications</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-secondary">
                          Loading prescriptions...
                        </td>
                      </tr>
                    ) : prescriptions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-secondary">
                          No prescriptions found matching the search criteria.
                        </td>
                      </tr>
                    ) : (
                      prescriptions.map((rx) => (
                        <tr key={rx.id} className="hover:bg-surface-2/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-text-primary text-sm">
                              {rx.prescriptionNumber}
                            </span>
                            <div className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {formatDate(rx.prescribedDate)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-text-primary flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-text-secondary" />
                              {rx.patientName}
                              {rx.patientAge && (
                                <span className="text-text-secondary font-normal">({rx.patientAge}y)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-secondary flex items-center gap-2 mt-0.5">
                              {rx.patientIdentifier && (
                                <span className="font-mono px-1 rounded bg-surface-2 border border-border">
                                  ID: {rx.patientIdentifier}
                                </span>
                              )}
                              {rx.patientPhone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="h-2.5 w-2.5" />
                                  {rx.patientPhone}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-text-primary flex items-center gap-1.5">
                              <Stethoscope className="h-3.5 w-3.5 text-text-secondary" />
                              {rx.doctorName}
                            </div>
                            {rx.doctorLicense && (
                              <div className="text-[11px] text-text-secondary">
                                Lic: <span className="font-mono">{rx.doctorLicense}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span className="font-medium text-text-primary">
                                {rx.items?.length || 0} item(s)
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {rx.items?.slice(0, 2).map((item) => (
                                  <span
                                    key={item.id}
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-surface-2 border border-border text-text-secondary max-w-[130px] truncate"
                                  >
                                    {item.prescribedDrugName} ({item.quantityRemaining}/{item.quantityPrescribed})
                                  </span>
                                ))}
                                {(rx.items?.length || 0) > 2 && (
                                  <span className="px-1 py-0.5 rounded text-[10px] bg-surface-2 text-text-secondary">
                                    +{(rx.items?.length || 0) - 2} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {rx.status === "PENDING" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                Pending Verification
                              </span>
                            )}
                            {rx.status === "VERIFIED" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                Verified & Ready
                              </span>
                            )}
                            {rx.status === "PARTIALLY_DISPENSED" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                Partial Fill
                              </span>
                            )}
                            {rx.status === "FULLY_DISPENSED" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                Fully Dispensed
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedRx(rx);
                                setDetailModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-text-primary hover:bg-surface-2 transition-colors"
                            >
                              {rx.status === "PENDING" ? "Verify & Review" : "View & Dispense"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLLED SUBSTANCES REGISTER TAB */}
        {activeTab === "register" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search Patient ID, Doctor License, Drug..."
                  value={registerSearch}
                  onChange={(e) => setRegisterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Controlled Substances Ledger
                </span>
              </div>
            </div>

            <div className="border border-border rounded-xl bg-surface overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-2/60 border-b border-border text-text-secondary font-medium">
                    <tr>
                      <th className="py-3 px-4">Recorded At</th>
                      <th className="py-3 px-4">Controlled Substance</th>
                      <th className="py-3 px-4">Batch / Rx#</th>
                      <th className="py-3 px-4">Patient Credentials</th>
                      <th className="py-3 px-4">Prescribing Doctor</th>
                      <th className="py-3 px-4 text-right">Dispensed Qty</th>
                      <th className="py-3 px-4 text-right">Running Balance</th>
                      <th className="py-3 px-4">Pharmacist & Witness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-text-secondary">
                          Loading controlled register...
                        </td>
                      </tr>
                    ) : controlledLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-text-secondary">
                          No controlled drug register entries recorded.
                        </td>
                      </tr>
                    ) : (
                      controlledLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-surface-2/30 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-text-secondary">
                            <div>{formatDate(log.recordedAt)}</div>
                            <div className="text-[10px]">{new Date(log.recordedAt).toLocaleTimeString()}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                              {log.product?.name || "Controlled Drug"}
                              {log.product?.schedule && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold border border-rose-400 text-rose-500">
                                  {log.product.schedule}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-secondary">
                              {log.product?.genericName} • {log.product?.strength}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <div>Batch: <span className="font-semibold text-text-primary">{log.batch?.batchNumber || "FEFO"}</span></div>
                            {log.prescription && (
                              <div className="text-text-secondary text-[10px]">Rx: {log.prescription.prescriptionNumber}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-text-primary">{log.patientName}</div>
                            <div className="font-mono text-[11px] text-text-secondary">
                              ID: <span className="font-bold">{log.patientIdentifier}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-text-primary">{log.doctorName}</div>
                            <div className="font-mono text-[11px] text-text-secondary">
                              Lic: {log.doctorLicense}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-bold text-rose-500 text-sm">
                              -{log.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-text-primary text-sm">
                            {log.balanceAfter} units
                          </td>
                          <td className="py-3 px-4 text-[11px]">
                            <div className="font-medium text-text-primary">{log.pharmacistName}</div>
                            {log.witnessName && (
                              <div className="text-text-secondary text-[10px]">
                                Witness: {log.witnessName}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CREATE PRESCRIPTION MODAL */}
        <AnimatePresence>
          {createModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col"
              >
                <div className="p-5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-accent" />
                    <h2 className="text-base font-bold text-text-primary">
                      Capture Manual Prescription
                    </h2>
                  </div>
                  <button onClick={() => setCreateModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateRx} className="p-5 space-y-5 flex-1">
                  {/* Patient Section */}
                  <div className="p-4 rounded-lg border border-border bg-surface-2/40 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      1. Patient Credentials
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">
                          Patient Full Name *
                        </label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. John Doe"
                          value={newRx.patientName}
                          onChange={(e) => setNewRx({ ...newRx, patientName: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">
                          Patient Identifier (National ID / Iqama / Passport)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 1029384756"
                          value={newRx.patientIdentifier}
                          onChange={(e) => setNewRx({ ...newRx, patientIdentifier: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">
                          Patient Phone
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. +966 50 123 4567"
                          value={newRx.patientPhone}
                          onChange={(e) => setNewRx({ ...newRx, patientPhone: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">Age</label>
                        <input
                          type="number"
                          placeholder="Age"
                          value={newRx.patientAge}
                          onChange={(e) => setNewRx({ ...newRx, patientAge: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">Gender</label>
                        <select
                          value={newRx.patientGender}
                          onChange={(e) => setNewRx({ ...newRx, patientGender: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">
                          Diagnosis / Indication
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Type 2 Diabetes / Bacterial pharyngitis"
                          value={newRx.diagnosis}
                          onChange={(e) => setNewRx({ ...newRx, diagnosis: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Doctor Section */}
                  <div className="p-4 rounded-lg border border-border bg-surface-2/40 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      2. Prescribing Doctor & Hospital
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">
                          Doctor Name *
                        </label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Dr. Arthur Conan"
                          value={newRx.doctorName}
                          onChange={(e) => setNewRx({ ...newRx, doctorName: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">
                          Doctor License / Reg No.
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. MD-38472"
                          value={newRx.doctorLicense}
                          onChange={(e) => setNewRx({ ...newRx, doctorLicense: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">
                          Clinic / Hospital
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. King Fahd Hospital"
                          value={newRx.clinicOrHospital}
                          onChange={(e) => setNewRx({ ...newRx, clinicOrHospital: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prescribed Items */}
                  <div className="p-4 rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                        3. Prescribed Medications ({newRx.items.length})
                      </h3>
                      <button
                        type="button"
                        onClick={handleAddItemRow}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-surface text-xs font-semibold text-text-primary hover:bg-surface-2 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Add Medication
                      </button>
                    </div>

                    <div className="space-y-3">
                      {newRx.items.map((item, idx) => (
                        <div key={idx} className="p-3 border border-border/80 rounded-lg bg-surface space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-text-secondary">Medication #{idx + 1}</span>
                            {newRx.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="text-xs text-rose-500 hover:text-rose-600 font-semibold"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-text-secondary block mb-0.5">Drug Name *</label>
                              <input
                                required
                                type="text"
                                placeholder="e.g. Augmentin 625mg tablet"
                                value={item.prescribedDrugName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNewRx((prev) => {
                                    const itms = [...prev.items];
                                    itms[idx].prescribedDrugName = val;
                                    return { ...prev, items: itms };
                                  });
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-text-secondary block mb-0.5">Catalog Link (Optional)</label>
                              <select
                                value={item.productId || "none"}
                                onChange={(e) => {
                                  const pId = e.target.value === "none" ? "" : e.target.value;
                                  const matched = products.find((p) => p.id === pId);
                                  setNewRx((prev) => {
                                    const itms = [...prev.items];
                                    itms[idx].productId = pId;
                                    if (matched) {
                                      if (!itms[idx].prescribedDrugName) {
                                        itms[idx].prescribedDrugName = matched.name;
                                      }
                                      const prodExtended = matched as Product & { isControlled?: boolean; schedule?: string };
                                      if (prodExtended.isControlled || prodExtended.schedule) {
                                        itms[idx].isControlled = true;
                                      }
                                    }
                                    return { ...prev, items: itms };
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none"
                              >
                                <option value="none">-- Free Text --</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.stock_qty || 0} in stock)
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] text-text-secondary block mb-0.5">Dosage / Strength</label>
                              <input
                                type="text"
                                placeholder="e.g. 625mg"
                                value={item.dosage}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNewRx((prev) => {
                                    const itms = [...prev.items];
                                    itms[idx].dosage = val;
                                    return { ...prev, items: itms };
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-text-secondary block mb-0.5">Frequency</label>
                              <input
                                type="text"
                                placeholder="e.g. 1-0-1"
                                value={item.frequency}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNewRx((prev) => {
                                    const itms = [...prev.items];
                                    itms[idx].frequency = val;
                                    return { ...prev, items: itms };
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-text-secondary block mb-0.5">Duration</label>
                              <input
                                type="text"
                                placeholder="e.g. 7 days"
                                value={item.duration}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNewRx((prev) => {
                                    const itms = [...prev.items];
                                    itms[idx].duration = val;
                                    return { ...prev, items: itms };
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-text-secondary block mb-0.5">Quantity Prescribed *</label>
                              <input
                                type="number"
                                min={1}
                                required
                                value={item.quantityPrescribed}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 1;
                                  setNewRx((prev) => {
                                    const itms = [...prev.items];
                                    itms[idx].quantityPrescribed = val;
                                    return { ...prev, items: itms };
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none font-bold"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id={`web-ctrl-${idx}`}
                              checked={item.isControlled}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setNewRx((prev) => {
                                  const itms = [...prev.items];
                                  itms[idx].isControlled = checked;
                                  return { ...prev, items: itms };
                                });
                              }}
                              className="rounded border-border text-rose-600 focus:ring-rose-500 h-4 w-4"
                            />
                            <label
                              htmlFor={`web-ctrl-${idx}`}
                              className="text-xs font-semibold text-rose-500 flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Flag as Controlled Substance (Audited in Controlled Drugs Register)
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Clinical & Dispensing Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Special instructions, patient allergies, verification details..."
                      value={newRx.notes}
                      onChange={(e) => setNewRx({ ...newRx, notes: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setCreateModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-surface-2 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingRx}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {submittingRx ? "Saving..." : "Save Prescription"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* PRESCRIPTION DETAIL & DISPENSE WORKFLOW MODAL */}
        <AnimatePresence>
          {detailModalOpen && selectedRx && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col"
              >
                <div className="p-5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold font-mono text-text-primary">
                      {selectedRx.prescriptionNumber}
                    </h2>
                    {selectedRx.status === "PENDING" && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Needs Verification
                      </span>
                    )}
                    {selectedRx.status === "VERIFIED" && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        Verified & Ready
                      </span>
                    )}
                    {selectedRx.status === "PARTIALLY_DISPENSED" && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        Partially Dispensed
                      </span>
                    )}
                    {selectedRx.status === "FULLY_DISPENSED" && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Fully Dispensed
                      </span>
                    )}
                  </div>
                  <button onClick={() => setDetailModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-5 space-y-5 flex-1">
                  {/* Credentials Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-border bg-surface-2/40 space-y-1">
                      <span className="font-bold text-text-secondary uppercase text-[10px]">Patient Information</span>
                      <p className="font-semibold text-text-primary text-sm">{selectedRx.patientName}</p>
                      <div className="text-text-secondary space-y-0.5">
                        {selectedRx.patientIdentifier && <p>ID: <span className="font-mono font-medium">{selectedRx.patientIdentifier}</span></p>}
                        {selectedRx.patientPhone && <p>Phone: {selectedRx.patientPhone}</p>}
                        {selectedRx.diagnosis && <p>Diagnosis: <span className="italic">{selectedRx.diagnosis}</span></p>}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-surface-2/40 space-y-1">
                      <span className="font-bold text-text-secondary uppercase text-[10px]">Prescribing Doctor</span>
                      <p className="font-semibold text-text-primary text-sm">{selectedRx.doctorName}</p>
                      <div className="text-text-secondary space-y-0.5">
                        {selectedRx.doctorLicense && <p>License: <span className="font-mono">{selectedRx.doctorLicense}</span></p>}
                        {selectedRx.clinicOrHospital && <p>Clinic: {selectedRx.clinicOrHospital}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Pharmacist Verification Action Banner */}
                  {selectedRx.status === "PENDING" ? (
                    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                      <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        Pharmacist Verification & Authorization Required
                      </div>
                      <p className="text-xs text-text-secondary">
                        In accordance with clinical safety protocols, a registered pharmacist must verify dosage, allergies, and contraindications before any medication can be dispensed.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Verification notes (e.g. Allergies verified, dosage approved)..."
                          value={verificationNotes}
                          onChange={(e) => setVerificationNotes(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none"
                        />
                        <button
                          disabled={verifying}
                          onClick={handleVerifyRx}
                          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50"
                        >
                          {verifying ? "Authorizing..." : "Verify & Authorize Dispense"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Verified by Pharmacist: <strong>{selectedRx.verifiedByName || "Licensed Pharmacist"}</strong></span>
                      </div>
                      {selectedRx.verifiedAt && <span>{formatDate(selectedRx.verifiedAt)}</span>}
                    </div>
                  )}

                  {/* Medications to Dispense */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Prescribed Medications
                    </h3>
                    <div className="border border-border rounded-xl bg-surface overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-2/60 border-b border-border text-text-secondary">
                          <tr>
                            <th className="py-2.5 px-3">Medication</th>
                            <th className="py-2.5 px-3">Dosage / Instructions</th>
                            <th className="py-2.5 px-3 text-center">Prescribed</th>
                            <th className="py-2.5 px-3 text-center">Dispensed</th>
                            <th className="py-2.5 px-3 text-center">Remaining</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {selectedRx.items?.map((item) => (
                            <tr key={item.id} className="hover:bg-surface-2/30">
                              <td className="py-2.5 px-3 font-semibold text-text-primary">
                                <div className="flex items-center gap-1.5">
                                  {item.prescribedDrugName}
                                  {item.isControlled && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-rose-500 text-rose-500">
                                      Controlled
                                    </span>
                                  )}
                                </div>
                                {item.dosage && <div className="text-[11px] text-text-secondary font-normal">{item.dosage}</div>}
                              </td>
                              <td className="py-2.5 px-3 text-text-secondary">
                                <div>{item.frequency || "—"}</div>
                                {item.instructions && <div className="text-[10px] italic">{item.instructions}</div>}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold">{item.quantityPrescribed}</td>
                              <td className="py-2.5 px-3 text-center text-text-secondary">{item.quantityDispensed}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-accent">{item.quantityRemaining}</td>
                              <td className="py-2.5 px-3 text-center">
                                {item.status === "COMPLETED" ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-500 font-semibold">
                                    Done
                                  </span>
                                ) : item.status === "PARTIAL" ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-500 font-semibold">
                                    Partial
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 font-semibold">
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  disabled={selectedRx.status === "PENDING" || item.quantityRemaining <= 0}
                                  onClick={() => openDispenseDialog(item)}
                                  className="px-3 py-1 rounded bg-foreground text-background text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                                >
                                  Dispense
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dispense Records Audit Trail */}
                  {selectedRx.dispenseRecords && selectedRx.dispenseRecords.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                        Dispensing Audit History ({selectedRx.dispenseRecords.length})
                      </h3>
                      <div className="border border-border rounded-xl bg-surface overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-surface-2/60 border-b border-border text-text-secondary">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Dispensed Medication</th>
                              <th className="py-2 px-3 text-center">Batch</th>
                              <th className="py-2 px-3 text-center">Qty</th>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3">Pharmacist</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {selectedRx.dispenseRecords.map((dr) => (
                              <tr key={dr.id}>
                                <td className="py-2 px-3 text-text-secondary">{formatDate(dr.dispensedAt)}</td>
                                <td className="py-2 px-3 font-medium text-text-primary">
                                  {dr.dispensedProduct?.name || "Product"}
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-text-secondary">
                                  {dr.batch?.batchNumber || "FEFO"}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-accent">{dr.quantity}</td>
                                <td className="py-2 px-3">
                                  {dr.isSubstitution ? (
                                    <span className="text-[10px] text-blue-500 font-semibold">
                                      Generic Substituted
                                    </span>
                                  ) : dr.isPartialFill ? (
                                    <span className="text-[10px] text-purple-500 font-semibold">
                                      Partial Fill
                                    </span>
                                  ) : (
                                    <span className="text-text-secondary">Standard</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-text-secondary">{dr.pharmacistName || "Pharmacist"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-border flex justify-end">
                  <button
                    onClick={() => setDetailModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-surface-2"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* DISPENSE ITEM & GENERIC SUBSTITUTION MODAL */}
        <AnimatePresence>
          {dispenseModalOpen && activeItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto flex flex-col"
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    <h2 className="text-sm font-bold text-text-primary">
                      Dispense: {activeItem.prescribedDrugName}
                    </h2>
                  </div>
                  <button onClick={() => setDispenseModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs flex-1">
                  <div className="p-3 rounded-lg border border-border bg-surface-2/40 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-text-primary">Prescribed Total: {activeItem.quantityPrescribed} units</p>
                      <p className="text-text-secondary">Remaining to dispense: <strong className="text-accent">{activeItem.quantityRemaining} units</strong></p>
                    </div>
                    {activeItem.isControlled && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-rose-500 text-rose-500 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Controlled
                      </span>
                    )}
                  </div>

                  {/* Brand to Generic Bioequivalent Substitution Engine */}
                  <div className="p-3 rounded-lg border border-border bg-surface space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-text-primary">
                        <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                        Brand-to-Generic Substitution Engine
                      </div>
                      {loadingSubs && <span className="text-[10px] text-text-secondary">Scanning bioequivalents...</span>}
                    </div>

                    {substitutions && substitutions.substitutions.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        <p className="text-[11px] text-text-secondary">
                          In-stock bioequivalent alternatives with active ingredient <strong>{substitutions.originalProduct.genericName}</strong>:
                        </p>
                        {substitutions.substitutions.map((sub) => (
                          <div
                            key={sub.id}
                            onClick={() => {
                              setDispensedProductId(sub.id);
                              setIsSubstitution(true);
                              setSubstitutionReason(
                                `Generic bioequivalent substitution (${sub.name}). Patient savings: ${formatCurrency(sub.priceDifference)}`
                              );
                            }}
                            className={cn(
                              "p-2 rounded-lg border cursor-pointer flex items-center justify-between transition-all",
                              dispensedProductId === sub.id
                                ? "border-blue-500 bg-blue-500/10"
                                : "border-border hover:bg-surface-2"
                            )}
                          >
                            <div>
                              <p className="font-semibold text-text-primary">{sub.name}</p>
                              <p className="text-[10px] text-text-secondary">
                                Price: {formatCurrency(sub.salePrice)} • In Stock: <strong className={sub.stockQty > 0 ? "text-emerald-500" : "text-rose-500"}>{sub.stockQty}</strong>
                              </p>
                            </div>
                            <div className="text-right">
                              {sub.priceDifference > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  Save {formatCurrency(sub.priceDifference)}
                                </span>
                              )}
                              <p className="text-[9px] text-text-secondary mt-0.5">Click to substitute</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-text-secondary italic">
                        {activeItem.productId
                          ? "No generic alternatives found in current store catalog."
                          : "Medication was captured manually. Select inventory product below."}
                      </p>
                    )}
                  </div>

                  {/* Dispensed Product Selector */}
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Product to Deduct from Inventory *
                    </label>
                    <select
                      value={dispensedProductId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDispensedProductId(val);
                        if (val !== activeItem.productId) {
                          setIsSubstitution(true);
                          setSubstitutionReason("Generic bioequivalent substitution dispensed");
                        } else {
                          setIsSubstitution(false);
                          setSubstitutionReason("");
                        }
                      }}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none"
                    >
                      <option value="">-- Select Inventory Product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.stock_qty || 0} in stock)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity to Dispense */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1">
                        Quantity to Dispense *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={activeItem.quantityRemaining}
                        value={dispenseQty}
                        onChange={(e) => setDispenseQty(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary font-bold focus:outline-none"
                      />
                      {dispenseQty < activeItem.quantityRemaining && (
                        <p className="text-[10px] text-purple-500 font-semibold mt-1">
                          Partial fill: {activeItem.quantityRemaining - dispenseQty} units will remain on Rx.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1">
                        Batch Allocation
                      </label>
                      <input
                        type="text"
                        disabled
                        value="Automatic FEFO (Earliest Expiry First)"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-text-secondary font-mono"
                      />
                    </div>
                  </div>

                  {/* Substitution Reason */}
                  {isSubstitution && (
                    <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1">
                      <label className="text-[11px] font-bold text-blue-500 block">
                        Substitution Reason *
                      </label>
                      <input
                        type="text"
                        value={substitutionReason}
                        onChange={(e) => setSubstitutionReason(e.target.value)}
                        placeholder="e.g. Patient preferred generic cost savings / Bioequivalent brand dispensed"
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Controlled Drug Witness */}
                  {activeItem.isControlled && (
                    <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 space-y-1">
                      <label className="text-[11px] font-bold text-rose-500 block">
                        Controlled Register Witness Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={witnessName}
                        onChange={(e) => setWitnessName(e.target.value)}
                        placeholder="e.g. Registered Nurse or Co-Pharmacist"
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Pharmacist Dispense Notes
                    </label>
                    <input
                      type="text"
                      value={dispenseNotes}
                      onChange={(e) => setDispenseNotes(e.target.value)}
                      placeholder="e.g. Patient counseled on side effects..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-border flex items-center justify-end gap-2">
                  <button
                    onClick={() => setDispenseModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={dispensing || !dispensedProductId}
                    onClick={handleConfirmDispense}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                  >
                    {dispensing ? "Dispensing..." : "Confirm Dispense"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
