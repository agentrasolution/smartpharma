"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalNav } from "@/components/portal-nav";
import {
  HeartPulse, UserCheck, RefreshCw, Search, ShieldCheck,
  AlertTriangle, CheckCircle2, MessageSquare,
  CreditCard, ChevronRight, X
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer, RefillQueueItem, CustomerStatement, ChronicMedication } from "@/types";

export default function PatientsPage() {
  const [activeTab, setActiveTab] = useState<"patients" | "refills">("patients");
  const [search, setSearch] = useState("");
  const [refillFilter, setRefillFilter] = useState<"all" | "dueSoon" | "dueToday" | "overdue">("all");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);

  const [refillQueue, setRefillQueue] = useState<RefillQueueItem[]>([]);
  const [refillLoading, setRefillLoading] = useState(true);

  // Patient detail & statement drawer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Contact / Refill dialog
  const [contactModalItem, setContactModalItem] = useState<RefillQueueItem | null>(null);
  const [contactNote, setContactNote] = useState("");
  const [refillModalItem, setRefillModalItem] = useState<RefillQueueItem | null>(null);
  const [refillDaysSupply, setRefillDaysSupply] = useState("30");
  const [refillNote, setRefillNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const data = await api.customers.list();
      setCustomers(data);
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const loadRefillQueue = useCallback(async () => {
    setRefillLoading(true);
    try {
      const data = await api.customers.refillQueue(refillFilter);
      setRefillQueue(data);
    } catch (err) {
      console.error("Failed to load refill queue:", err);
    } finally {
      setRefillLoading(false);
    }
  }, [refillFilter]);

  const loadCustomerDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setStatementLoading(true);
    try {
      const [cust, stmt] = await Promise.all([
        api.customers.getById(id),
        api.customers.getStatement(id),
      ]);
      setSelectedCustomer(cust);
      setStatement(stmt);
    } catch (err) {
      console.error("Failed to load customer detail:", err);
    } finally {
      setDetailLoading(false);
      setStatementLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRefillQueue();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadRefillQueue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedCustomerId) {
        loadCustomerDetail(selectedCustomerId);
      } else {
        setSelectedCustomer(null);
        setStatement(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedCustomerId, loadCustomerDetail]);

  const handleContactSubmit = async () => {
    if (!contactModalItem || !contactNote.trim()) return;
    setIsSubmitting(true);
    try {
      await api.customers.recordContact(contactModalItem.id, contactNote);
      await loadRefillQueue();
      if (selectedCustomerId) await loadCustomerDetail(selectedCustomerId);
      setContactModalItem(null);
      setContactNote("");
    } catch (err) {
      console.error("Failed to save contact note:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefillSubmit = async () => {
    if (!refillModalItem) return;
    setIsSubmitting(true);
    try {
      await api.customers.recordRefill(refillModalItem.id, {
        daysSupply: Number(refillDaysSupply) || 30,
        notes: refillNote,
      });
      await loadRefillQueue();
      if (selectedCustomerId) await loadCustomerDetail(selectedCustomerId);
      setRefillModalItem(null);
      setRefillNote("");
    } catch (err) {
      console.error("Failed to record refill:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter((c: Customer) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.national_id ?? "").toLowerCase().includes(q)
    );
  });

  const totalPatients = customers.length;
  const activeChronicCount = customers.reduce((sum, c) => sum + (c.active_chronic_meds ?? 0), 0);
  const overdueCount = refillQueue.filter((r) => r.urgency === "OVERDUE").length;
  const totalArrears = customers.reduce((sum, c) => sum + (c.outstanding_arrear ?? 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <PortalNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Patients, Chronic Refills & Credit
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
                Pillar H
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Patient clinical profiles, informed health consent, automated chronic medication refills, and arrears ledger.
            </p>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between text-text-secondary text-xs">
              <span>Total Patients</span>
              <UserCheck className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold font-mono text-text-primary">{totalPatients}</div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between text-text-secondary text-xs">
              <span>Active Chronic Regimens</span>
              <HeartPulse className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-400">{activeChronicCount}</div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between text-text-secondary text-xs">
              <span>Overdue Refills</span>
              <AlertTriangle className="h-4 w-4 text-danger" />
            </div>
            <div className="text-2xl font-bold font-mono text-danger">{overdueCount}</div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-1">
            <div className="flex items-center justify-between text-text-secondary text-xs">
              <span>Customer Arrears Due</span>
              <CreditCard className="h-4 w-4 text-warning" />
            </div>
            <div className="text-2xl font-bold font-mono text-warning">{formatCurrency(totalArrears)}</div>
          </div>
        </div>

        {/* Tab Controls & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("patients")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "patients"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "bg-surface text-text-secondary hover:text-text-primary border border-border"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Patient Directory ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab("refills")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "refills"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "bg-surface text-text-secondary hover:text-text-primary border border-border"
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Chronic Refill Queue ({refillQueue.length})
            </button>
          </div>

          {activeTab === "patients" ? (
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search patient, phone, national ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-surface text-xs focus:outline-hidden focus:border-accent"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {(["all", "overdue", "dueToday", "dueSoon"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRefillFilter(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    refillFilter === mode
                      ? "bg-surface-2 text-text-primary font-bold border border-accent/40"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {mode === "all" ? "All (<= 14d)" : mode === "overdue" ? "Overdue" : mode === "dueToday" ? "Due Today" : "Due Soon"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Tab 1: Patients Directory */}
        {activeTab === "patients" && (
          <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2/60 border-b border-border text-text-secondary font-medium">
                  <tr>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Clinical Profile</th>
                    <th className="px-4 py-3">Consent</th>
                    <th className="px-4 py-3 text-right">Credit Balance</th>
                    <th className="px-4 py-3 text-right">Invoices</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {customersLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-secondary">
                        Loading patient records...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-secondary">
                        No patients found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-2/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-text-primary text-xs">{c.name}</div>
                          {c.national_id && <div className="font-mono text-[10px] text-text-secondary">ID: {c.national_id}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary">{c.phone || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(c.allergies?.length ?? 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-danger/10 text-danger border border-danger/20">
                                Allergy ({c.allergies?.length})
                              </span>
                            )}
                            {(c.active_chronic_meds ?? 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                Chronic ({c.active_chronic_meds})
                              </span>
                            )}
                            {!(c.allergies?.length ?? 0) && !(c.active_chronic_meds ?? 0) && <span className="text-text-secondary">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {c.consent_given ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                              <ShieldCheck className="h-3 w-3" /> Signed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
                              <AlertTriangle className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium">
                          {(c.outstanding_arrear ?? 0) > 0 ? (
                            <span className="text-warning">{formatCurrency(c.outstanding_arrear ?? 0)}</span>
                          ) : (
                            <span className="text-text-secondary">0.00</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">{c.total_purchases ?? 0}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedCustomerId(c.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline cursor-pointer"
                          >
                            View Record <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Content Tab 2: Chronic Refill Reminders Queue */}
        {activeTab === "refills" && (
          <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2/60 border-b border-border text-text-secondary font-medium">
                  <tr>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Medication & Regimen</th>
                    <th className="px-4 py-3">Stock Available</th>
                    <th className="px-4 py-3">Next Refill Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Reminder</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {refillLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-secondary">
                        Loading chronic refill queue...
                      </td>
                    </tr>
                  ) : refillQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-text-secondary">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-success/60 mb-2" />
                        No patients due for refills in this time frame.
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
                        <tr key={item.id} className="hover:bg-surface-2/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-text-primary text-xs">{item.customer_name}</div>
                            <div className="font-mono text-[10px] text-text-secondary">{item.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-xs text-text-primary">{item.medication_name}</div>
                            <div className="text-[11px] text-text-secondary">
                              {item.dosage} {item.frequency ? `\u2022 ${item.frequency}` : ""} ({item.days_supply}d supply)
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {item.product_name ? (
                              <span className={`font-mono font-medium ${item.product_stock > 0 ? "text-success" : "text-danger"}`}>
                                {item.product_stock > 0 ? `${item.product_stock} in stock` : "0 stock"}
                              </span>
                            ) : (
                              <span className="text-text-secondary text-[10px]">Unlinked</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-text-secondary">{formatDate(item.next_refill_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${urgencyColor}`}>
                              {item.urgency === "OVERDUE"
                                ? `${Math.abs(item.days_remaining)}d Overdue`
                                : item.urgency === "DUE_TODAY"
                                ? "Due Today"
                                : `${item.days_remaining}d Left`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary text-[11px]">
                            {item.last_contacted_at ? (
                              <div>
                                <span className="font-mono text-[10px]">{formatDate(item.last_contacted_at)}</span>
                                {item.contact_notes && <div className="text-[10px] truncate max-w-[120px]">{item.contact_notes}</div>}
                              </div>
                            ) : (
                              <span className="text-text-secondary/50">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => {
                                  setContactModalItem(item);
                                  setContactNote(item.contact_notes || "");
                                }}
                                className="px-2 py-1 rounded-lg border border-border bg-surface text-text-primary hover:border-accent text-[11px] font-medium transition-all cursor-pointer"
                              >
                                Contact
                              </button>
                              <button
                                onClick={() => {
                                  setRefillModalItem(item);
                                  setRefillDaysSupply(String(item.days_supply || 30));
                                  setRefillNote("");
                                }}
                                className="px-2 py-1 rounded-lg bg-accent text-accent-foreground hover:bg-accent-hover text-[11px] font-semibold transition-all cursor-pointer"
                              >
                                Refill
                              </button>
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
        )}

        {/* Patient Profile & Ledger Drawer / Modal */}
        {selectedCustomerId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-surface h-full border-l border-border p-6 overflow-y-auto space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{selectedCustomer?.name || "Patient Record"}</h2>
                  <span className="text-xs text-text-secondary font-mono">{selectedCustomerId}</span>
                </div>
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {detailLoading ? (
                <div className="py-20 text-center text-xs text-text-secondary">Loading patient record...</div>
              ) : selectedCustomer ? (
                <div className="space-y-6">
                  {/* Clinical & Consent Summary */}
                  <div className="p-4 rounded-xl border border-border bg-surface-2/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <HeartPulse className="h-4 w-4 text-purple-400" />
                        Clinical & Health Consent
                      </span>
                      {selectedCustomer.consent_given ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                          <ShieldCheck className="h-3 w-3" /> Consent Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
                          <AlertTriangle className="h-3 w-3" /> Consent Missing
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-text-secondary">Phone:</span> <span className="font-mono text-text-primary">{selectedCustomer.phone}</span></div>
                      <div><span className="text-text-secondary">National ID:</span> <span className="font-mono text-text-primary">{selectedCustomer.national_id || "—"}</span></div>
                      <div><span className="text-text-secondary">Gender / Blood:</span> <span className="text-text-primary">{selectedCustomer.gender || "—"} / {selectedCustomer.blood_group || "—"}</span></div>
                      <div><span className="text-text-secondary">Credit Limit:</span> <span className="font-mono text-text-primary">{formatCurrency(selectedCustomer.credit_limit ?? 0)}</span></div>
                    </div>

                    {selectedCustomer.allergies && selectedCustomer.allergies.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <span className="text-[10px] font-semibold text-danger block mb-1">Recorded Drug Allergies</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedCustomer.allergies.map((a: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium bg-danger/10 text-danger border border-danger/20">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chronic Regimens */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                      Active Chronic Regimens ({selectedCustomer.chronic_medications?.length ?? 0})
                    </h3>
                    {(selectedCustomer.chronic_medications?.length ?? 0) === 0 ? (
                      <div className="p-3 text-center text-xs text-text-secondary rounded-lg border border-border bg-surface-2/20">
                        No chronic medication regimens recorded.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedCustomer.chronic_medications?.map((m: ChronicMedication) => (
                          <div key={m.id} className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between text-xs">
                            <div>
                              <div className="font-semibold text-text-primary">{m.medication_name}</div>
                              <div className="text-text-secondary text-[11px]">{m.dosage} \u2022 {m.frequency} ({m.days_supply}d supply)</div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-mono text-text-secondary block">Next: {formatDate(m.next_refill_date)}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent">
                                {m.days_remaining}d Left
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Account Statement & Running Ledger */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                        Customer Ledger & Statement
                      </h3>
                      {statement && (
                        <span className="font-mono text-xs font-bold text-warning">
                          Balance: {formatCurrency(statement.summary.current_balance)}
                        </span>
                      )}
                    </div>

                    {statementLoading ? (
                      <div className="py-6 text-center text-xs text-text-secondary">Loading ledger statement...</div>
                    ) : !statement || statement.entries.length === 0 ? (
                      <div className="p-3 text-center text-xs text-text-secondary rounded-lg border border-border bg-surface-2/20">
                        No credit invoices or payments on record.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-surface-2/60 text-text-secondary border-b border-border">
                            <tr>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Description</th>
                              <th className="px-3 py-2 text-right">Debit</th>
                              <th className="px-3 py-2 text-right">Credit</th>
                              <th className="px-3 py-2 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {statement.entries.map((entry, idx) => (
                              <tr key={idx} className="hover:bg-surface-2/30">
                                <td className="px-3 py-2 font-mono text-[11px] text-text-secondary">{formatDate(entry.date)}</td>
                                <td className="px-3 py-2 text-text-primary truncate max-w-[180px]">{entry.description}</td>
                                <td className="px-3 py-2 font-mono text-right">{entry.debit > 0 ? formatCurrency(entry.debit) : "—"}</td>
                                <td className="px-3 py-2 font-mono text-right text-success">{entry.credit > 0 ? formatCurrency(entry.credit) : "—"}</td>
                                <td className="px-3 py-2 font-mono text-right font-bold text-text-primary">{formatCurrency(entry.runningBalance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Contact Note Modal */}
        {contactModalItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface rounded-2xl border border-border p-5 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                Log Refill Reminder Note
              </h3>
              <p className="text-xs text-text-secondary">
                Communication with {contactModalItem.customer_name} ({contactModalItem.customer_phone}) for {contactModalItem.medication_name}.
              </p>
              <textarea
                value={contactNote}
                onChange={(e) => setContactNote(e.target.value)}
                placeholder="e.g. Sent reminder via WhatsApp; patient acknowledged."
                className="w-full p-2.5 rounded-xl border border-border bg-background text-xs h-24 focus:outline-hidden focus:border-accent"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setContactModalItem(null)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContactSubmit}
                  disabled={!contactNote.trim() || isSubmitting}
                  className="px-3 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Refill Dispense Modal */}
        {refillModalItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface rounded-2xl border border-border p-5 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-success" />
                Dispense Chronic Refill
              </h3>
              <p className="text-xs text-text-secondary">
                Advance chronic medication schedule for {refillModalItem.customer_name} ({refillModalItem.medication_name}).
              </p>
              <div className="space-y-2">
                <label className="text-xs text-text-secondary block">Days Supply</label>
                <input
                  type="number"
                  value={refillDaysSupply}
                  onChange={(e) => setRefillDaysSupply(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-text-secondary block">Dispensing Notes</label>
                <input
                  type="text"
                  value={refillNote}
                  onChange={(e) => setRefillNote(e.target.value)}
                  placeholder="e.g. 30-day refill dispensed at pharmacy counter"
                  className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setRefillModalItem(null)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefillSubmit}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold cursor-pointer"
                >
                  Confirm Refill & Advance
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
