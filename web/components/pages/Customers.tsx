"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, Plus, Phone, MapPin, Pencil, Trash2, Download, Lock,
  AlertTriangle, HeartPulse, ShieldCheck, ShieldAlert, Clock,
  Calendar, FileText, CheckCircle2, MessageSquare, RefreshCw, UserCheck
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import type { Customer, CustomerInput, RefillQueueItem } from "@/types";

export default function Customers() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const navigate = (href: string) => router.push(href);
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState<"customers" | "refills">("customers");
  const [search, setSearch] = useState("");
  const [refillFilter, setRefillFilter] = useState<"all" | "dueSoon" | "dueToday" | "overdue">("all");

  // Customer Form State
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTab, setFormTab] = useState("general");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergiesText, setAllergiesText] = useState("");
  const [chronicConditionsText, setChronicConditionsText] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [creditLimit, setCreditLimit] = useState("0");
  const [allowCredit, setAllowCredit] = useState(true);
  const [notes, setNotes] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentNotes, setConsentNotes] = useState("");

  // Delete & Security states
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [forceDeleteOpen, setForceDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<{ salesCount: number; arrearsCount: number } | null>(null);
  const [adminPassword, setAdminPassword] = useState("");

  // Contact / Refill dialog states
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedRefillItem, setSelectedRefillItem] = useState<RefillQueueItem | null>(null);
  const [contactNotesInput, setContactNotesInput] = useState("");
  const [refillDialogOpen, setRefillDialogOpen] = useState(false);
  const [refillDaysSupply, setRefillDaysSupply] = useState("30");
  const [refillNotesInput, setRefillNotesInput] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers.list,
  });

  const { data: refillQueue = [], isLoading: refillLoading } = useQuery({
    queryKey: ["refill-queue", refillFilter],
    queryFn: () => api.customers.refillQueue(refillFilter),
  });

  const resetForm = () => {
    setEditingId(null);
    setFormTab("general");
    setName("");
    setPhone("");
    setAddress("");
    setFatherName("");
    setFatherPhone("");
    setNationalId("");
    setDateOfBirth("");
    setGender("");
    setBloodGroup("");
    setAllergiesText("");
    setChronicConditionsText("");
    setEmergencyContactName("");
    setEmergencyContactPhone("");
    setCreditLimit("0");
    setAllowCredit(true);
    setNotes("");
    setConsentGiven(false);
    setConsentNotes("");
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const allergies = allergiesText.split(",").map((s) => s.trim()).filter(Boolean);
      const chronicConditions = chronicConditionsText.split(",").map((s) => s.trim()).filter(Boolean);
      return api.customers.create({
        name,
        phone,
        address,
        fatherName,
        fatherPhone,
        nationalId,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : null,
        gender,
        bloodGroup,
        allergies,
        chronicConditions,
        emergencyContactName,
        emergencyContactPhone,
        creditLimit: Number(creditLimit) || 0,
        allowCredit,
        notes,
        consentGiven,
        consentNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      resetForm();
      toast.success("Customer / Patient profile created");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const allergies = allergiesText.split(",").map((s) => s.trim()).filter(Boolean);
      const chronicConditions = chronicConditionsText.split(",").map((s) => s.trim()).filter(Boolean);
      return api.customers.update(editingId!, {
        name,
        phone,
        address,
        fatherName,
        fatherPhone,
        nationalId,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : null,
        gender,
        bloodGroup,
        allergies,
        chronicConditions,
        emergencyContactName,
        emergencyContactPhone,
        creditLimit: Number(creditLimit) || 0,
        allowCredit,
        notes,
        consentGiven,
        consentNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      resetForm();
      toast.success("Customer / Patient profile updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.customers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted");
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  const forceDeleteMutation = useMutation({
    mutationFn: async () => {
      const pwResult = await api.auth.verifyPassword(adminPassword);
      if (!pwResult.valid) throw new Error("Incorrect admin password");
      return api.customers.delete(deleteTarget!.id, { force: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setForceDeleteOpen(false);
      setDeleteTarget(null);
      setDeleteInfo(null);
      setAdminPassword("");
      toast.success("Customer deleted");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const contactMutation = useMutation({
    mutationFn: ({ medId, notes }: { medId: string; notes: string }) =>
      api.customers.recordContact(medId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refill-queue"] });
      setContactDialogOpen(false);
      setSelectedRefillItem(null);
      setContactNotesInput("");
      toast.success("Patient contact reminder logged");
    },
    onError: (err) => toast.error(err.message),
  });

  const refillMutation = useMutation({
    mutationFn: ({ medId, daysSupply, notes }: { medId: string; daysSupply: number; notes: string }) =>
      api.customers.recordRefill(medId, { daysSupply, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refill-queue"] });
      setRefillDialogOpen(false);
      setSelectedRefillItem(null);
      setRefillNotesInput("");
      toast.success("Chronic refill recorded & schedule advanced");
    },
    onError: (err) => toast.error(err.message),
  });

  function handleDeleteClick(c: Customer) {
    if ((c.total_purchases ?? 0) > 0 || (c.outstanding_arrear ?? 0) > 0) {
      setDeleteTarget(c);
      setDeleteInfo({ salesCount: c.total_purchases ?? 0, arrearsCount: c.outstanding_arrear ?? 0 });
      setAdminPassword("");
      setForceDeleteOpen(true);
    } else {
      setDeleteId(c.id);
    }
  }

  const filteredCustomers = customers.filter((c: Customer) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.national_id ?? "").toLowerCase().includes(q) ||
      (c.father_name ?? "").toLowerCase().includes(q)
    );
  });

  function openAdd() {
    resetForm();
    setOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      openAdd();
    }
  }, [searchParams]);

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setAddress(c.address);
    setFatherName(c.father_name ?? "");
    setFatherPhone(c.father_phone ?? "");
    setNationalId(c.national_id ?? "");
    setDateOfBirth(c.date_of_birth ? c.date_of_birth.split("T")[0] : "");
    setGender(c.gender ?? "");
    setBloodGroup(c.blood_group ?? "");
    setAllergiesText((c.allergies ?? []).join(", "));
    setChronicConditionsText((c.chronic_conditions ?? []).join(", "));
    setEmergencyContactName(c.emergency_contact_name ?? "");
    setEmergencyContactPhone(c.emergency_contact_phone ?? "");
    setCreditLimit(String(c.credit_limit ?? 0));
    setAllowCredit(c.allow_credit ?? true);
    setNotes(c.notes ?? "");
    setConsentGiven(c.consent_given ?? false);
    setConsentNotes(c.consent_notes ?? "");
    setFormTab("general");
    setOpen(true);
  }

  const customerColumns = [
    {
      key: "name",
      header: "Patient / Customer",
      cell: (c: Customer) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-primary hover:text-accent cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
            {c.name}
          </span>
          {c.national_id && (
            <span className="font-mono text-[10px] text-text-secondary">ID: {c.national_id}</span>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Contact",
      cell: (c: Customer) => (
        <div className="text-xs">
          <span className="font-mono text-text-secondary">{c.phone || "—"}</span>
          {c.father_phone && <span className="block text-[10px] text-text-secondary/70">Alt: {c.father_phone}</span>}
        </div>
      ),
    },
    {
      key: "profile",
      header: "Clinical Profile",
      cell: (c: Customer) => {
        const hasAllergies = (c.allergies?.length ?? 0) > 0;
        const hasChronic = (c.chronic_conditions?.length ?? 0) > 0 || (c.active_chronic_meds ?? 0) > 0;
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {hasAllergies && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-danger/10 text-danger border border-danger/20" title={`Allergies: ${c.allergies?.join(", ")}`}>
                Allergy ({c.allergies?.length})
              </span>
            )}
            {hasChronic && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20" title="Has active chronic regimen">
                Chronic ({c.active_chronic_meds ?? c.chronic_conditions?.length ?? 0})
              </span>
            )}
            {!hasAllergies && !hasChronic && <span className="text-text-secondary text-xs">—</span>}
          </div>
        );
      },
    },
    {
      key: "consent",
      header: "Consent",
      cell: (c: Customer) => (
        c.consent_given ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
            <CheckCircle2 className="h-3 w-3" /> Signed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
            <AlertTriangle className="h-3 w-3" /> Pending
          </span>
        )
      ),
    },
    {
      key: "arrear",
      header: "Credit Balance",
      cell: (c: Customer) => {
        const arrear = c.outstanding_arrear ?? 0;
        return (
          <span className={cn("font-mono font-medium text-xs", arrear > 0 ? "text-warning" : "text-text-secondary")}>
            {arrear > 0 ? formatCurrency(arrear) : "0.00"}
          </span>
        );
      },
    },
    {
      key: "purchases",
      header: "Purchases",
      cell: (c: Customer) => <span className="font-mono text-sm">{c.total_purchases ?? 0}</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (c: Customer) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => navigate(`/customers/${c.id}`)} className="h-7 px-2 rounded-md text-xs font-medium text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors">
            Profile
          </button>
          <button onClick={() => openEdit(c)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => handleDeleteClick(c)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Patients & Customers"
        description="Patient medical profiles, health data consent, chronic refill reminders, and credit ledger"
        action={{ label: "Add Patient / Customer", onClick: openAdd }}
      />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <div className="flex items-center justify-between border-b border-border pb-2">
          <TabsList>
            <TabsTrigger value="customers" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Patient Directory ({customers.length})
            </TabsTrigger>
            <TabsTrigger value="refills" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Chronic Refill Queue ({refillQueue.length})
            </TabsTrigger>
          </TabsList>

          {mainTab === "customers" && (
            <div className="flex items-center gap-2">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <Input
                  autoFocus
                  placeholder="Search by name, phone, national ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() =>
                  downloadCSV(
                    `patients_${new Date().toISOString().split("T")[0]}.csv`,
                    ["ID", "Name", "National ID", "Phone", "Consent", "Arrears", "Purchases"],
                    filteredCustomers.map((c: Customer) => [
                      c.id, c.name, c.national_id || "", c.phone,
                      c.consent_given ? "YES" : "NO",
                      c.outstanding_arrear || 0,
                      c.total_purchases || 0,
                    ])
                  )
                }
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export
              </Button>
            </div>
          )}

          {mainTab === "refills" && (
            <div className="flex items-center gap-2">
              <Button
                variant={refillFilter === "all" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setRefillFilter("all")}
              >
                All (&le; 14 Days)
              </Button>
              <Button
                variant={refillFilter === "overdue" ? "destructive" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setRefillFilter("overdue")}
              >
                Overdue
              </Button>
              <Button
                variant={refillFilter === "dueToday" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setRefillFilter("dueToday")}
              >
                Due Today
              </Button>
              <Button
                variant={refillFilter === "dueSoon" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setRefillFilter("dueSoon")}
              >
                Due Soon (&le; 7d)
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="customers" className="mt-4">
          <div className="rounded-xl border border-border">
            <DataTable
              columns={customerColumns}
              data={filteredCustomers}
              loading={customersLoading}
              keyExtractor={(c: Customer) => c.id}
            />
          </div>
        </TabsContent>

        <TabsContent value="refills" className="mt-4">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/40">
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Patient</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Medication & Regimen</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Stock Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Next Refill</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">Last Reminder</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {refillLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-xs text-text-secondary">
                        Loading chronic refill queue...
                      </td>
                    </tr>
                  ) : refillQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-secondary text-xs">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-success/60 mb-2" />
                        No patients due for chronic refill in this filter window.
                      </td>
                    </tr>
                  ) : (
                    refillQueue.map((item) => {
                      const urgencyColor =
                        item.urgency === "OVERDUE"
                          ? "bg-danger/10 text-danger border-danger/30"
                          : item.urgency === "DUE_TODAY"
                          ? "bg-warning/10 text-warning border-warning/30"
                          : "bg-accent/10 text-accent border-accent/30";

                      return (
                        <tr key={item.id} className="hover:bg-surface-2/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-text-primary text-xs hover:text-accent cursor-pointer" onClick={() => navigate(`/customers/${item.customer_id}`)}>
                              {item.customer_name}
                            </div>
                            <div className="font-mono text-[11px] text-text-secondary">{item.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-xs text-text-primary">{item.medication_name}</div>
                            <div className="text-[11px] text-text-secondary">
                              {item.dosage} {item.frequency ? `• ${item.frequency}` : ""} ({item.days_supply}d supply)
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {item.product_name ? (
                              <div className="text-xs">
                                <span className={cn("font-mono font-medium", item.product_stock > 0 ? "text-success" : "text-danger")}>
                                  {item.product_stock > 0 ? `${item.product_stock} in stock` : "Out of stock"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-text-secondary">Unlinked catalog item</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                            {formatDate(item.next_refill_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", urgencyColor)}>
                              {item.urgency === "OVERDUE"
                                ? `${Math.abs(item.days_remaining)}d Overdue`
                                : item.urgency === "DUE_TODAY"
                                ? "Due Today"
                                : `${item.days_remaining}d Left`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary">
                            {item.last_contacted_at ? (
                              <div>
                                <span className="text-[10px] font-mono">{formatDate(item.last_contacted_at)}</span>
                                {item.contact_notes && (
                                  <div className="text-[10px] text-text-secondary truncate max-w-[140px]" title={item.contact_notes}>
                                    {item.contact_notes}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-text-secondary/50 text-[11px]">Not contacted</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1"
                                onClick={() => {
                                  setSelectedRefillItem(item);
                                  setContactNotesInput(item.contact_notes || "");
                                  setContactDialogOpen(true);
                                }}
                              >
                                <MessageSquare className="h-3 w-3" />
                                Contact
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[11px] gap-1 bg-accent text-accent-foreground hover:bg-accent-hover"
                                onClick={() => {
                                  setSelectedRefillItem(item);
                                  setRefillDaysSupply(String(item.days_supply || 30));
                                  setRefillNotesInput("");
                                  setRefillDialogOpen(true);
                                }}
                              >
                                <RefreshCw className="h-3 w-3" />
                                Refill
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Patient Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4 text-accent" />
              {editingId ? "Edit Patient / Customer Profile" : "Register Patient / Customer"}
            </DialogTitle>
            <DialogDescription>
              Complete demographics, clinical conditions, health consent, and credit limits.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={formTab} onValueChange={setFormTab} className="mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="general">1. General Info</TabsTrigger>
              <TabsTrigger value="clinical">2. Clinical Profile</TabsTrigger>
              <TabsTrigger value="consent">3. Consent & Credit</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tariq Mansoor" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Primary Phone *</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 50 123 4567" className="h-8 text-xs font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">National ID / Iqama / Passport</Label>
                  <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="e.g. 1098765432" className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address / District</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, District, City" className="h-8 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Guardian / Father Name</Label>
                  <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Optional guardian name" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Guardian / Father Phone</Label>
                  <Input value={fatherPhone} onChange={(e) => setFatherPhone(e.target.value)} placeholder="Optional guardian phone" className="h-8 text-xs font-mono" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="clinical" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                  >
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Blood Group</Label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-danger font-semibold">Known Drug Allergies (Comma-separated)</Label>
                <Input
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa, Aspirin"
                  className="h-8 text-xs border-danger/40 focus:border-danger"
                />
                <span className="text-[10px] text-text-secondary">Dispensing counter checks these when filling prescriptions.</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Chronic Conditions (Comma-separated)</Label>
                <Input
                  value={chronicConditionsText}
                  onChange={(e) => setChronicConditionsText(e.target.value)}
                  placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Emergency Contact Person</Label>
                  <Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Next of kin name" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Emergency Contact Phone</Label>
                  <Input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="Next of kin phone" className="h-8 text-xs font-mono" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="consent" className="space-y-3 pt-3">
              <div className="p-3 rounded-lg border border-border bg-surface-2/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="consentCheck" checked={consentGiven} onCheckedChange={(v) => setConsentGiven(!!v)} />
                  <Label htmlFor="consentCheck" className="text-xs font-semibold cursor-pointer">
                    Patient Health Data Processing Consent
                  </Label>
                </div>
                <p className="text-[11px] text-text-secondary pl-6 leading-relaxed">
                  Patient gives informed consent for the pharmacy to store their medical history, chronic medication schedule, and contact them for refill reminders.
                </p>
                {consentGiven && (
                  <div className="pl-6 pt-1">
                    <Input
                      value={consentNotes}
                      onChange={(e) => setConsentNotes(e.target.value)}
                      placeholder="Consent verification notes (e.g. Signed physical form / digital agreement)"
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Credit Limit</Label>
                  <Input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs font-mono"
                  />
                  <span className="text-[10px] text-text-secondary">Maximum allowed arrears balance.</span>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="allowCreditCheck" checked={allowCredit} onCheckedChange={(v) => setAllowCredit(!!v)} />
                  <Label htmlFor="allowCreditCheck" className="text-xs font-medium cursor-pointer">
                    Allow Credit Purchases at POS
                  </Label>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Internal Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes about patient preferences, doctor references, or special instructions..."
                  className="h-16 text-xs"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
              disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Update Patient" : "Save Patient Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Contact Reminder Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-accent" />
              Log Refill Reminder Contact
            </DialogTitle>
            <DialogDescription>
              Record communication attempt with {selectedRefillItem?.customer_name} ({selectedRefillItem?.customer_phone}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="text-xs text-text-secondary">
              Medication: <span className="font-semibold text-text-primary">{selectedRefillItem?.medication_name}</span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact Outcome Notes</Label>
              <Textarea
                value={contactNotesInput}
                onChange={(e) => setContactNotesInput(e.target.value)}
                placeholder="e.g. Called patient; confirmed pickup this evening. Sent WhatsApp notification."
                className="h-20 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => selectedRefillItem && contactMutation.mutate({ medId: selectedRefillItem.id, notes: contactNotesInput })}
              disabled={!contactNotesInput.trim() || contactMutation.isPending}
            >
              Save Contact Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Refill Dispensed Dialog */}
      <Dialog open={refillDialogOpen} onOpenChange={setRefillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 text-success" />
              Dispense Chronic Refill
            </DialogTitle>
            <DialogDescription>
              Advance chronic medication schedule for {selectedRefillItem?.customer_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="text-xs space-y-1 bg-surface-2/40 p-2.5 rounded-lg border border-border">
              <div>Medication: <span className="font-medium text-text-primary">{selectedRefillItem?.medication_name}</span></div>
              <div>Dosage: <span className="text-text-primary">{selectedRefillItem?.dosage}</span></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Days Supply for this Refill</Label>
              <Input
                type="number"
                value={refillDaysSupply}
                onChange={(e) => setRefillDaysSupply(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Refill Notes</Label>
              <Input
                value={refillNotesInput}
                onChange={(e) => setRefillNotesInput(e.target.value)}
                placeholder="e.g. Picked up full 30-day supply"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRefillDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() =>
                selectedRefillItem &&
                refillMutation.mutate({
                  medId: selectedRefillItem.id,
                  daysSupply: Number(refillDaysSupply) || 30,
                  notes: refillNotesInput,
                })
              }
              disabled={refillMutation.isPending}
            >
              Confirm Refill & Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force delete confirmation modal */}
      <Dialog open={forceDeleteOpen} onOpenChange={setForceDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="h-4 w-4" />
              Force Delete Customer
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} has {deleteInfo?.salesCount} sale(s) and {deleteInfo?.arrearsCount} arrear(s). Deleting will remove these records permanently. Admin password required.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs">Admin Password</Label>
            <Input
              type="password"
              placeholder="Enter admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setForceDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => forceDeleteMutation.mutate()} disabled={!adminPassword || forceDeleteMutation.isPending}>
              Confirm Force Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
