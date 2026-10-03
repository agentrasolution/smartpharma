import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText, CheckCircle2, AlertTriangle, ShieldAlert, Plus,
  Search, Stethoscope, RefreshCw, UserCheck, ArrowRightLeft,
  Calendar, Phone, User, Clock,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import type {
  Prescription,
  PrescriptionItem,
  ControlledDrugRegister,
  SubstitutionSuggestionResult,
  Product,
} from "@/types";

export default function DispensingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"queue" | "register">("queue");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [registerSearch, setRegisterSearch] = useState("");

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Dispensing Item Modal
  const [dispenseItemModalOpen, setDispenseItemModalOpen] = useState(false);
  const [activeItemToDispense, setActiveItemToDispense] = useState<PrescriptionItem | null>(null);
  const [dispenseQty, setDispenseQty] = useState<number>(1);
  const [dispenseNotes, setDispenseNotes] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [dispensedProductId, setDispensedProductId] = useState<string>("");
  const [isSubstitution, setIsSubstitution] = useState(false);
  const [substitutionReason, setSubstitutionReason] = useState("");
  const [substitutions, setSubstitutions] = useState<SubstitutionSuggestionResult | null>(null);
  const [loadingSubstitutions, setLoadingSubstitutions] = useState(false);

  // Pharmacist Verification Form
  const [verificationNotes, setVerificationNotes] = useState("");

  // Create Rx Form State
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
        instructions: "Take with plenty of water",
        quantityPrescribed: 10,
        isControlled: false,
      },
    ],
  });

  // Queries
  const { data: prescriptions = [], isLoading: loadingRx, refetch: refetchRx } = useQuery({
    queryKey: ["prescriptions", statusFilter, searchQuery],
    queryFn: () =>
      api.prescriptions.list({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: searchQuery || undefined,
      }),
  });

  const { data: controlledLogs = [], isLoading: loadingRegister, refetch: refetchRegister } = useQuery({
    queryKey: ["controlled-register", registerSearch],
    queryFn: () =>
      api.prescriptions.controlledRegister({
        search: registerSearch || undefined,
      }),
  });

  const { data: productsData } = useQuery({
    queryKey: ["products-select"],
    queryFn: () => api.products.list({ pageSize: 100 }),
  });
  const products: Product[] = Array.isArray(productsData)
    ? productsData
    : (productsData as any)?.data ?? [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.prescriptions.create(data),
    onSuccess: () => {
      toast.success("Prescription captured successfully");
      setCreateModalOpen(false);
      resetNewRx();
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create prescription");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.prescriptions.verify(id, { verified: true, notes }),
    onSuccess: (updated) => {
      toast.success("Prescription verified & authorized by pharmacist");
      setSelectedRx(updated);
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Verification failed");
    },
  });

  const dispenseMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.prescriptions.dispense(id, payload),
    onSuccess: (updated) => {
      toast.success("Medication dispensed and batch stock updated");
      setSelectedRx(updated);
      setDispenseItemModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["controlled-register"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Dispensing failed");
    },
  });

  function resetNewRx() {
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
          instructions: "Take with plenty of water",
          quantityPrescribed: 10,
          isControlled: false,
        },
      ],
    });
  }

  function handleAddItem() {
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

  function handleRemoveItem(idx: number) {
    if (newRx.items.length <= 1) return;
    setNewRx((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newRx.patientName.trim()) {
      toast.error("Patient name is required");
      return;
    }
    if (!newRx.doctorName.trim()) {
      toast.error("Doctor name is required");
      return;
    }

    const hasControlled = newRx.items.some((i) => i.isControlled);
    if (hasControlled) {
      if (!newRx.patientIdentifier.trim()) {
        toast.error("Controlled medications require a Patient Identifier (National ID/Iqama/Passport)");
        return;
      }
      if (!newRx.doctorLicense.trim()) {
        toast.error("Controlled medications require Doctor License credentials");
        return;
      }
    }

    createMutation.mutate({
      ...newRx,
      patientAge: newRx.patientAge ? parseInt(newRx.patientAge, 10) : null,
      items: newRx.items.map((i) => ({
        ...i,
        productId: i.productId || null,
        quantityPrescribed: Number(i.quantityPrescribed),
      })),
    });
  }

  async function openDispenseDialog(item: PrescriptionItem) {
    setActiveItemToDispense(item);
    setDispenseQty(item.quantityRemaining);
    setDispenseNotes("");
    setWitnessName("");
    setSelectedBatchId("");
    setDispensedProductId(item.productId || "");
    setIsSubstitution(false);
    setSubstitutionReason("");
    setSubstitutions(null);

    // If item is linked to a product, fetch substitutions
    if (item.productId) {
      setLoadingSubstitutions(true);
      try {
        const subs = await api.prescriptions.suggestSubstitutions(item.productId);
        setSubstitutions(subs);
      } catch (err) {
        console.error("Failed to load substitutions:", err);
      } finally {
        setLoadingSubstitutions(false);
      }
    }

    setDispenseItemModalOpen(true);
  }

  function handleConfirmDispense() {
    if (!selectedRx || !activeItemToDispense) return;
    if (dispenseQty <= 0) {
      toast.error("Dispense quantity must be greater than zero");
      return;
    }
    if (dispenseQty > activeItemToDispense.quantityRemaining) {
      toast.error(`Cannot dispense more than remaining quantity (${activeItemToDispense.quantityRemaining})`);
      return;
    }
    if (!dispensedProductId) {
      toast.error("Please select a valid product to dispense from stock");
      return;
    }

    dispenseMutation.mutate({
      id: selectedRx.id,
      payload: {
        items: [
          {
            prescriptionItemId: activeItemToDispense.id,
            dispensedProductId,
            batchId: selectedBatchId || null,
            quantity: dispenseQty,
            isSubstitution,
            substitutionReason: isSubstitution ? substitutionReason : null,
            notes: dispenseNotes,
            witnessName: witnessName || null,
          },
        ],
      },
    });
  }

  // Summary counts
  const pendingCount = prescriptions.filter((r) => r.status === "PENDING").length;
  const verifiedCount = prescriptions.filter((r) => r.status === "VERIFIED").length;
  const partialCount = prescriptions.filter((r) => r.status === "PARTIALLY_DISPENSED").length;
  const fullyDispensedCount = prescriptions.filter((r) => r.status === "FULLY_DISPENSED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispensing & Prescriptions"
        description="Pillar E: Clinical prescription capture, pharmacist verification, generic bioequivalent substitution & controlled register"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchRx();
                refetchRegister();
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateModalOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Capture Prescription
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Pending Verification</p>
              <p className="text-2xl font-bold text-amber-500 mt-1">{pendingCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Verified & Ready</p>
              <p className="text-2xl font-bold text-blue-500 mt-1">{verifiedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Partially Dispensed</p>
              <p className="text-2xl font-bold text-purple-500 mt-1">{partialCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Fully Dispensed</p>
              <p className="text-2xl font-bold text-emerald-500 mt-1">{fullyDispensedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="queue" className="gap-2">
            <FileText className="h-4 w-4" />
            Prescriptions Queue
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            Controlled Drugs Register
          </TabsTrigger>
        </TabsList>

        {/* PRESCRIPTIONS QUEUE TAB */}
        <TabsContent value="queue" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-secondary" />
              <Input
                placeholder="Search Rx#, Patient, Doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending Verification</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="PARTIALLY_DISPENSED">Partially Dispensed</SelectItem>
                  <SelectItem value="FULLY_DISPENSED">Fully Dispensed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              <DataTable
                columns={[
                  {
                    key: "rxNumber",
                    header: "Rx Number",
                    cell: (rx: Prescription) => (
                      <div>
                        <span className="font-semibold text-text-primary text-sm font-mono">
                          {rx.prescriptionNumber}
                        </span>
                        <div className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {formatDate(rx.prescribedDate)}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "patient",
                    header: "Patient Details",
                    cell: (rx: Prescription) => (
                      <div>
                        <div className="font-medium text-text-primary flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-text-secondary" />
                          {rx.patientName}
                          {rx.patientAge && (
                            <span className="text-xs text-text-secondary">({rx.patientAge}y)</span>
                          )}
                        </div>
                        <div className="text-xs text-text-secondary flex items-center gap-2 mt-0.5">
                          {rx.patientIdentifier && (
                            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                              ID: {rx.patientIdentifier}
                            </Badge>
                          )}
                          {rx.patientPhone && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="h-2.5 w-2.5" />
                              {rx.patientPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "doctor",
                    header: "Prescribing Doctor",
                    cell: (rx: Prescription) => (
                      <div>
                        <div className="font-medium text-text-primary flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5 text-text-secondary" />
                          {rx.doctorName}
                        </div>
                        {rx.doctorLicense && (
                          <div className="text-xs text-text-secondary">
                            Lic: <span className="font-mono">{rx.doctorLicense}</span>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "items",
                    header: "Prescribed Items",
                    cell: (rx: Prescription) => (
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-text-primary">
                          {rx.items?.length || 0} medication(s)
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {rx.items?.slice(0, 2).map((i) => (
                            <Badge
                              key={i.id}
                              variant="neutral"
                              className="text-[10px] px-1.5 py-0 max-w-[140px] truncate"
                            >
                              {i.prescribedDrugName} ({i.quantityRemaining}/{i.quantityPrescribed})
                            </Badge>
                          ))}
                          {(rx.items?.length || 0) > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              +{(rx.items?.length || 0) - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (rx: Prescription) => {
                      if (rx.status === "PENDING") {
                        return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Needs Verification</Badge>;
                      }
                      if (rx.status === "VERIFIED") {
                        return <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30">Verified & Ready</Badge>;
                      }
                      if (rx.status === "PARTIALLY_DISPENSED") {
                        return <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/30">Partial Fill</Badge>;
                      }
                      if (rx.status === "FULLY_DISPENSED") {
                        return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Fully Dispensed</Badge>;
                      }
                      return <Badge variant="outline">{rx.status}</Badge>;
                    },
                  },
                  {
                    key: "action",
                    header: "Action",
                    cell: (rx: Prescription) => (
                      <Button
                        size="sm"
                        variant={rx.status === "PENDING" ? "default" : "outline"}
                        onClick={() => {
                          setSelectedRx(rx);
                          setDetailModalOpen(true);
                        }}
                        className="text-xs h-7"
                      >
                        {rx.status === "PENDING" ? "Review & Verify" : "View & Dispense"}
                      </Button>
                    ),
                  },
                ]}
                data={prescriptions}
                loading={loadingRx}
                keyExtractor={(rx) => rx.id}
                emptyMessage="No prescriptions found matching the filter."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTROLLED SUBSTANCES REGISTER TAB */}
        <TabsContent value="register" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-secondary" />
              <Input
                placeholder="Search Patient ID, Doctor License, Drug..."
                value={registerSearch}
                onChange={(e) => setRegisterSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 border-rose-500/30 text-rose-500 bg-rose-500/10 py-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Immutable Controlled Audit Ledger
              </Badge>
            </div>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              <DataTable
                columns={[
                  {
                    key: "date",
                    header: "Recorded At",
                    cell: (r: ControlledDrugRegister) => (
                      <div className="text-xs">
                        <span className="font-medium text-text-primary">
                          {formatDate(r.recordedAt)}
                        </span>
                        <div className="text-[10px] text-text-secondary font-mono">
                          {new Date(r.recordedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "drug",
                    header: "Controlled Drug",
                    cell: (r: ControlledDrugRegister) => (
                      <div>
                        <div className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
                          {r.product?.name || "Controlled Item"}
                          {r.product?.schedule && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-rose-400 text-rose-500">
                              {r.product.schedule}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {r.product?.genericName} • {r.product?.strength}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "batch",
                    header: "Batch / Rx",
                    cell: (r: ControlledDrugRegister) => (
                      <div className="text-xs font-mono">
                        <div>Batch: <span className="font-semibold">{r.batch?.batchNumber || "FEFO"}</span></div>
                        {r.prescription && (
                          <div className="text-[11px] text-text-secondary">Rx: {r.prescription.prescriptionNumber}</div>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "patient",
                    header: "Patient",
                    cell: (r: ControlledDrugRegister) => (
                      <div>
                        <div className="font-medium text-text-primary text-xs">{r.patientName}</div>
                        <div className="text-[11px] text-text-secondary font-mono">
                          ID: <span className="font-semibold">{r.patientIdentifier}</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "doctor",
                    header: "Prescriber",
                    cell: (r: ControlledDrugRegister) => (
                      <div>
                        <div className="font-medium text-text-primary text-xs">{r.doctorName}</div>
                        <div className="text-[11px] text-text-secondary font-mono">
                          Lic: {r.doctorLicense}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "qty",
                    header: "Dispensed",
                    cell: (r: ControlledDrugRegister) => (
                      <div className="text-right">
                        <span className="font-bold text-rose-500 text-sm">
                          -{r.quantity}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "balance",
                    header: "Running Balance",
                    cell: (r: ControlledDrugRegister) => (
                      <div className="text-right font-mono font-bold text-text-primary text-sm">
                        {r.balanceAfter} units
                      </div>
                    ),
                  },
                  {
                    key: "pharmacist",
                    header: "Pharmacist & Witness",
                    cell: (r: ControlledDrugRegister) => (
                      <div className="text-xs">
                        <div className="text-text-primary font-medium">{r.pharmacistName}</div>
                        {r.witnessName && (
                          <div className="text-[10px] text-text-secondary">
                            Witness: {r.witnessName}
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={controlledLogs}
                loading={loadingRegister}
                keyExtractor={(r) => r.id}
                emptyMessage="No controlled medication entries recorded."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE PRESCRIPTION MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Capture Manual Prescription
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-5">
            {/* Patient Header */}
            <div className="border border-border/60 rounded-lg p-4 space-y-3 bg-muted/20">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                1. Patient Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Patient Full Name *</Label>
                  <Input
                    required
                    placeholder="e.g. John Doe"
                    value={newRx.patientName}
                    onChange={(e) => setNewRx({ ...newRx, patientName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Patient Identifier (ID/Passport/Phone)</Label>
                  <Input
                    placeholder="e.g. 1029384756"
                    value={newRx.patientIdentifier}
                    onChange={(e) => setNewRx({ ...newRx, patientIdentifier: e.target.value })}
                  />
                  <p className="text-[10px] text-text-secondary">Required for controlled drugs</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Patient Phone</Label>
                  <Input
                    placeholder="e.g. +966 50 123 4567"
                    value={newRx.patientPhone}
                    onChange={(e) => setNewRx({ ...newRx, patientPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Age</Label>
                  <Input
                    type="number"
                    placeholder="Age"
                    value={newRx.patientAge}
                    onChange={(e) => setNewRx({ ...newRx, patientAge: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <Select
                    value={newRx.patientGender}
                    onValueChange={(val) => setNewRx({ ...newRx, patientGender: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Diagnosis / Clinical Indication</Label>
                  <Input
                    placeholder="e.g. Acute bronchitis / Hypertension"
                    value={newRx.diagnosis}
                    onChange={(e) => setNewRx({ ...newRx, diagnosis: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Prescriber Header */}
            <div className="border border-border/60 rounded-lg p-4 space-y-3 bg-muted/20">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                2. Doctor & Hospital Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Doctor Name *</Label>
                  <Input
                    required
                    placeholder="e.g. Dr. Robert Adams"
                    value={newRx.doctorName}
                    onChange={(e) => setNewRx({ ...newRx, doctorName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Doctor License / Reg No.</Label>
                  <Input
                    placeholder="e.g. MD-98214"
                    value={newRx.doctorLicense}
                    onChange={(e) => setNewRx({ ...newRx, doctorLicense: e.target.value })}
                  />
                  <p className="text-[10px] text-text-secondary">Required for controlled drugs</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Clinic / Hospital</Label>
                  <Input
                    placeholder="e.g. City General Hospital"
                    value={newRx.clinicOrHospital}
                    onChange={(e) => setNewRx({ ...newRx, clinicOrHospital: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Prescribed Items Dynamic Rows */}
            <div className="border border-border/60 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  3. Prescribed Medications ({newRx.items.length})
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" />
                  Add Medication
                </Button>
              </div>

              <div className="space-y-3">
                {newRx.items.map((item, idx) => (
                  <div key={idx} className="p-3 border border-border/50 rounded-md bg-background/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-text-secondary">Medication #{idx + 1}</span>
                      {newRx.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(idx)}
                          className="h-6 text-xs text-rose-500 hover:text-rose-600 px-2"
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Drug Name *</Label>
                        <Input
                          required
                          placeholder="e.g. Amoxicillin 500mg capsules"
                          value={item.prescribedDrugName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewRx((prev) => {
                              const itms = [...prev.items];
                              itms[idx].prescribedDrugName = val;
                              return { ...prev, items: itms };
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Link Inventory Item (Optional)</Label>
                        <Select
                          value={item.productId || "none"}
                          onValueChange={(val) => {
                            const pId = val === "none" ? "" : val;
                            const matchedProd = products.find((p) => p.id === pId);
                            setNewRx((prev) => {
                              const itms = [...prev.items];
                              itms[idx].productId = pId;
                              if (matchedProd) {
                                if (!itms[idx].prescribedDrugName) {
                                  itms[idx].prescribedDrugName = matchedProd.name;
                                }
                                if ((matchedProd as any).isControlled || (matchedProd as any).schedule) {
                                  itms[idx].isControlled = true;
                                }
                              }
                              return { ...prev, items: itms };
                            });
                          }}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Select product..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- None (Manual Name) --</SelectItem>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} {p.stock_qty ? `(${p.stock_qty} in stock)` : "(0 in stock)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Dosage / Strength</Label>
                        <Input
                          placeholder="e.g. 500mg"
                          value={item.dosage}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewRx((prev) => {
                              const itms = [...prev.items];
                              itms[idx].dosage = val;
                              return { ...prev, items: itms };
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Frequency</Label>
                        <Input
                          placeholder="e.g. 1-0-1 after food"
                          value={item.frequency}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewRx((prev) => {
                              const itms = [...prev.items];
                              itms[idx].frequency = val;
                              return { ...prev, items: itms };
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Duration</Label>
                        <Input
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
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity Prescribed *</Label>
                        <Input
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
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id={`controlled-${idx}`}
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
                      <label htmlFor={`controlled-${idx}`} className="text-xs font-medium text-rose-500 flex items-center gap-1 cursor-pointer">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Flag as Controlled Substance (Audited in Controlled Drugs Register)
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">General Clinical Notes</Label>
              <Input
                placeholder="Allergy checks, doctor phone confirmation, etc."
                value={newRx.notes}
                onChange={(e) => setNewRx({ ...newRx, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="gap-1.5">
                <FileText className="h-4 w-4" />
                {createMutation.isPending ? "Saving..." : "Save Prescription"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PRESCRIPTION DETAIL & DISPENSE WORKFLOW DIALOG */}
      {selectedRx && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold font-mono">
                    {selectedRx.prescriptionNumber}
                  </DialogTitle>
                  {selectedRx.status === "PENDING" && (
                    <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Needs Verification</Badge>
                  )}
                  {selectedRx.status === "VERIFIED" && (
                    <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30">Verified & Ready</Badge>
                  )}
                  {selectedRx.status === "PARTIALLY_DISPENSED" && (
                    <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/30">Partially Dispensed</Badge>
                  )}
                  {selectedRx.status === "FULLY_DISPENSED" && (
                    <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Fully Dispensed</Badge>
                  )}
                </div>
                <div className="text-xs text-text-secondary">
                  Prescribed: {formatDate(selectedRx.prescribedDate)}
                </div>
              </div>
            </DialogHeader>

            {/* Header info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="border border-border/60 rounded-md p-3 bg-muted/20 space-y-1">
                <span className="font-semibold text-text-secondary uppercase tracking-wider text-[10px]">Patient</span>
                <p className="font-medium text-text-primary text-sm">{selectedRx.patientName}</p>
                <div className="text-text-secondary space-y-0.5">
                  {selectedRx.patientIdentifier && <p>ID: <span className="font-mono font-medium">{selectedRx.patientIdentifier}</span></p>}
                  {selectedRx.patientPhone && <p>Phone: {selectedRx.patientPhone}</p>}
                  {selectedRx.diagnosis && <p>Diagnosis: <span className="italic">{selectedRx.diagnosis}</span></p>}
                </div>
              </div>

              <div className="border border-border/60 rounded-md p-3 bg-muted/20 space-y-1">
                <span className="font-semibold text-text-secondary uppercase tracking-wider text-[10px]">Prescriber</span>
                <p className="font-medium text-text-primary text-sm">{selectedRx.doctorName}</p>
                <div className="text-text-secondary space-y-0.5">
                  {selectedRx.doctorLicense && <p>License: <span className="font-mono">{selectedRx.doctorLicense}</span></p>}
                  {selectedRx.clinicOrHospital && <p>Clinic: {selectedRx.clinicOrHospital}</p>}
                </div>
              </div>
            </div>

            {/* Verification Banner */}
            {selectedRx.status === "PENDING" ? (
              <div className="border border-amber-500/40 rounded-lg p-4 bg-amber-500/10 space-y-3">
                <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Pharmacist Clinical Review & Verification Required
                </div>
                <p className="text-xs text-text-secondary">
                  Before dispensing, a licensed pharmacist must review patient identity, contraindications, and prescribed dosage.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <Input
                    placeholder="Pharmacist verification notes (e.g. Dosage verified, allergy check clear)..."
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    className="text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    disabled={verifyMutation.isPending}
                    onClick={() =>
                      verifyMutation.mutate({ id: selectedRx.id, notes: verificationNotes })
                    }
                    className="gap-1.5 whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    {verifyMutation.isPending ? "Verifying..." : "Verify & Authorize Dispense"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs px-3 py-2 border border-emerald-500/30 rounded-md bg-emerald-500/10 text-emerald-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Authorized by Pharmacist: <strong className="font-semibold">{selectedRx.verifiedByName || "Licensed Pharmacist"}</strong></span>
                </div>
                {selectedRx.verifiedAt && <span>{formatDate(selectedRx.verifiedAt)}</span>}
              </div>
            )}

            {/* Prescribed Items Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Prescription Items & Dispensing Actions
              </h4>
              <div className="border border-border/60 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-text-secondary font-medium">
                    <tr>
                      <th className="p-2.5 text-left">Medication</th>
                      <th className="p-2.5 text-left">Directions</th>
                      <th className="p-2.5 text-center">Prescribed</th>
                      <th className="p-2.5 text-center">Dispensed</th>
                      <th className="p-2.5 text-center">Remaining</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {selectedRx.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/10">
                        <td className="p-2.5 font-medium text-text-primary">
                          <div className="flex items-center gap-1.5">
                            {item.prescribedDrugName}
                            {item.isControlled && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-rose-500 text-rose-500">
                                Controlled
                              </Badge>
                            )}
                          </div>
                          {item.dosage && <div className="text-[11px] text-text-secondary">{item.dosage}</div>}
                        </td>
                        <td className="p-2.5 text-text-secondary">
                          <div>{item.frequency || "—"}</div>
                          {item.duration && <div className="text-[10px]">{item.duration}</div>}
                        </td>
                        <td className="p-2.5 text-center font-semibold text-text-primary">{item.quantityPrescribed}</td>
                        <td className="p-2.5 text-center font-medium text-text-secondary">{item.quantityDispensed}</td>
                        <td className="p-2.5 text-center font-bold text-primary">{item.quantityRemaining}</td>
                        <td className="p-2.5 text-center">
                          {item.status === "COMPLETED" ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                              Completed
                            </Badge>
                          ) : item.status === "PARTIAL" ? (
                            <Badge variant="outline" className="text-[10px] text-purple-500 border-purple-500/30">
                              Partial Fill
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            size="sm"
                            disabled={selectedRx.status === "PENDING" || item.quantityRemaining <= 0}
                            onClick={() => openDispenseDialog(item)}
                            className="h-7 text-xs gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Dispense
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Past Dispense Records */}
            {selectedRx.dispenseRecords && selectedRx.dispenseRecords.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Dispense History & Audit Trail ({selectedRx.dispenseRecords.length})
                </h4>
                <div className="border border-border/60 rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 border-b border-border/50 text-text-secondary">
                      <tr>
                        <th className="p-2 text-left">Date / Time</th>
                        <th className="p-2 text-left">Dispensed Product</th>
                        <th className="p-2 text-center">Batch</th>
                        <th className="p-2 text-center">Quantity</th>
                        <th className="p-2 text-left">Type / Substitution</th>
                        <th className="p-2 text-left">Pharmacist</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {selectedRx.dispenseRecords.map((dr) => (
                        <tr key={dr.id}>
                          <td className="p-2 text-text-secondary">{formatDate(dr.dispensedAt)}</td>
                          <td className="p-2 font-medium text-text-primary">
                            {dr.dispensedProduct?.name || "Medication"}
                          </td>
                          <td className="p-2 text-center font-mono text-text-secondary">
                            {dr.batch?.batchNumber || "FEFO"}
                          </td>
                          <td className="p-2 text-center font-bold text-primary">{dr.quantity}</td>
                          <td className="p-2">
                            {dr.isSubstitution ? (
                              <Badge variant="outline" className="text-[9px] border-blue-400 text-blue-500">
                                Substituted: {dr.substitutionReason || "Bioequivalent"}
                              </Badge>
                            ) : dr.isPartialFill ? (
                              <Badge variant="outline" className="text-[9px] border-purple-400 text-purple-500">
                                Partial Fill
                              </Badge>
                            ) : (
                              <span className="text-text-secondary">Standard Fill</span>
                            )}
                          </td>
                          <td className="p-2 text-text-secondary">{dr.pharmacistName || "Pharmacist"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DISPENSE ITEM & SUBSTITUTION ENGINE MODAL */}
      {activeItemToDispense && (
        <Dialog open={dispenseItemModalOpen} onOpenChange={setDispenseItemModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Dispense Medication: {activeItemToDispense.prescribedDrugName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="border border-border/60 rounded-md p-3 bg-muted/20 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-text-primary">Prescribed: {activeItemToDispense.quantityPrescribed} units</p>
                  <p className="text-text-secondary">Remaining to dispense: <strong className="text-primary">{activeItemToDispense.quantityRemaining} units</strong></p>
                </div>
                {activeItemToDispense.isControlled && (
                  <Badge variant="outline" className="border-rose-500 text-rose-500 gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Controlled Substance
                  </Badge>
                )}
              </div>

              {/* Brand-to-Generic Substitution Engine */}
              <div className="border border-border/60 rounded-md p-3 space-y-3 bg-background">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                    Brand-to-Generic Substitution Engine
                  </div>
                  {loadingSubstitutions && <span className="text-[11px] text-text-secondary">Searching bioequivalents...</span>}
                </div>

                {substitutions && substitutions.substitutions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-text-secondary text-[11px]">
                      Identical active ingredient (<strong>{substitutions.originalProduct.genericName}</strong>) alternatives in stock:
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {substitutions.substitutions.map((sub) => (
                        <div
                          key={sub.id}
                          onClick={() => {
                            setDispensedProductId(sub.id);
                            setIsSubstitution(true);
                            setSubstitutionReason(
                              `Brand-to-generic bioequivalent (${sub.name}). Patient savings: ${formatCurrency(sub.priceDifference)}`
                            );
                            if (sub.batches && sub.batches.length > 0) {
                              setSelectedBatchId(sub.batches[0].id);
                            }
                          }}
                          className={`p-2.5 rounded border cursor-pointer transition-all flex items-center justify-between ${
                            dispensedProductId === sub.id
                              ? "border-blue-500 bg-blue-500/10"
                              : "border-border/60 hover:border-border hover:bg-muted/20"
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-text-primary flex items-center gap-1.5">
                              {sub.name}
                              {sub.sameDosageForm && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                  {sub.dosageForm}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-text-secondary">
                              Price: {formatCurrency(sub.salePrice)} • In Stock: <strong className={sub.stockQty > 0 ? "text-emerald-500" : "text-rose-500"}>{sub.stockQty}</strong>
                            </div>
                          </div>

                          <div className="text-right">
                            {sub.priceDifference > 0 ? (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
                                Save {formatCurrency(sub.priceDifference)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Alternative
                              </Badge>
                            )}
                            <div className="text-[10px] text-text-secondary mt-0.5">Click to substitute</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-text-secondary italic">
                    {activeItemToDispense.productId
                      ? "No generic alternatives found in store catalog."
                      : "Prescribed drug not linked to master product. Select inventory item below."}
                  </p>
                )}
              </div>

              {/* Dispense Product Selection */}
              <div className="space-y-1">
                <Label className="text-xs">Product to Deduct from Inventory *</Label>
                <Select
                  value={dispensedProductId}
                  onValueChange={(val) => {
                    setDispensedProductId(val);
                    if (val !== activeItemToDispense.productId) {
                      setIsSubstitution(true);
                      setSubstitutionReason("Generic bioequivalent substitution dispensed");
                    } else {
                      setIsSubstitution(false);
                      setSubstitutionReason("");
                    }
                  }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select inventory product to dispense..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.stock_qty ? `(${p.stock_qty} in stock)` : "(0 in stock)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity to Dispense (Partial Fill Support) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Quantity to Dispense *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={activeItemToDispense.quantityRemaining}
                    value={dispenseQty}
                    onChange={(e) => setDispenseQty(parseInt(e.target.value, 10) || 1)}
                  />
                  {dispenseQty < activeItemToDispense.quantityRemaining && (
                    <p className="text-[10px] text-purple-500 font-medium">
                      Partial fill: {activeItemToDispense.quantityRemaining - dispenseQty} units will remain on Rx
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Batch Selection</Label>
                  <Input
                    placeholder="Auto FEFO (Earliest Expiry First)"
                    disabled
                    className="bg-muted/30 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Substitution Details (if substituted) */}
              {isSubstitution && (
                <div className="space-y-1 border border-blue-500/30 rounded p-2.5 bg-blue-500/5">
                  <Label className="text-xs text-blue-500 font-semibold">Substitution Clinical Reason *</Label>
                  <Input
                    value={substitutionReason}
                    onChange={(e) => setSubstitutionReason(e.target.value)}
                    placeholder="e.g. Brand not available / Patient requested generic savings"
                  />
                </div>
              )}

              {/* Controlled Substance Witness */}
              {activeItemToDispense.isControlled && (
                <div className="space-y-1 border border-rose-500/30 rounded p-2.5 bg-rose-500/5">
                  <Label className="text-xs text-rose-500 font-semibold">Controlled Register Witness Name</Label>
                  <Input
                    value={witnessName}
                    onChange={(e) => setWitnessName(e.target.value)}
                    placeholder="e.g. Nurse Jane Smith / Pharmacist Assistant"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Dispense Notes</Label>
                <Input
                  value={dispenseNotes}
                  onChange={(e) => setDispenseNotes(e.target.value)}
                  placeholder="Patient counseling notes, batch condition..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDispenseItemModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={dispenseMutation.isPending || !dispensedProductId}
                onClick={handleConfirmDispense}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                {dispenseMutation.isPending ? "Dispensing..." : "Confirm Dispense"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
