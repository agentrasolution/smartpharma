"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Phone, Package, Search, Plus, Pencil, Trash2, Download, LayoutGrid, List } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { Company } from "@/types";

export default function Companies() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", second_number: "" });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: companies = [], isLoading } = useQuery({ queryKey: ["companies"], queryFn: api.companies.list });

  const filtered = companies.filter((c: Company) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const createMutation = useMutation({
    mutationFn: () => api.companies.create(form),
    onSuccess: () => {
      toast.success("Company created");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      setForm({ name: "", phone: "", address: "", second_number: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.companies.update(editingId!, form),
    onSuccess: () => {
      toast.success("Company updated");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      setEditingId(null);
      setForm({ name: "", phone: "", address: "", second_number: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.companies.delete(id),
    onSuccess: () => {
      toast.success("Company deleted");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", phone: "", address: "", second_number: "" });
    setOpen(true);
  }

  function openEdit(c: Company) {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone, address: c.address, second_number: c.second_number });
    setOpen(true);
  }

  const totalProductsCount = companies.reduce((acc: number, c: Company) => acc + (c.product_count || 0), 0);
  const totalDirectContacts = companies.filter((c: Company) => c.phone || c.second_number).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmaceutical Companies"
        description="Manage manufacturing brands, corporate contacts, and registered drug portfolios."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-accent/10 text-accent font-semibold border border-accent/20">
            {companies.length} Companies
          </span>
        }
        action={{ label: "Add Company", onClick: openAdd, icon: <Plus className="h-3.5 w-3.5" /> }}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Manufacturers"
          value={companies.length}
          icon={<Building2 className="h-5 w-5" />}
          color="accent"
          loading={isLoading}
          subtitle="Registered pharma brands"
        />
        <StatCard
          title="Active Direct Contacts"
          value={totalDirectContacts}
          icon={<Phone className="h-5 w-5" />}
          color="purple"
          loading={isLoading}
          subtitle="Verified corporate lines"
        />
        <StatCard
          title="Associated Products"
          value={totalProductsCount}
          icon={<Package className="h-5 w-5" />}
          color="success"
          loading={isLoading}
          subtitle="Catalog formulations mapped"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-border/80 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            placeholder="Search company or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl text-xs bg-surface-2/40 border-border/80 focus:bg-surface"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            onClick={() => downloadCSV(`companies_${new Date().toISOString().split("T")[0]}.csv`, ["Name","Company Contact","Contact #2","Address","Products"], filtered.map((c: Company) => [c.name, c.phone, c.second_number||"", c.address, c.product_count||0]))}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            onClick={() => downloadPDF(`companies_${new Date().toISOString().split("T")[0]}.pdf`, "Companies List", ["Name","Company Contact","Contact #2","Address","Products"], filtered.map((c: Company) => [c.name, c.phone, c.second_number||"", c.address, c.product_count||0]))}
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>

          <div className="flex items-center border border-border/80 rounded-xl overflow-hidden bg-surface-2/40 p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("p-1.5 rounded-lg transition-colors", viewMode === "grid" ? "bg-accent text-white shadow-xs" : "text-text-secondary hover:text-text-primary")}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 rounded-lg transition-colors", viewMode === "list" ? "bg-accent text-white shadow-xs" : "text-text-secondary hover:text-text-primary")}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "list" ? (
        <DataTable
          columns={[
            { key: "name", header: "Name", cell: (c: Company) => <span className="font-semibold text-text-primary">{c.name}</span> },
            { key: "phone", header: "Contact", cell: (c: Company) => <span className="font-mono text-xs text-text-secondary">{c.phone}</span> },
            { key: "second_number", header: "Contact #2", cell: (c: Company) => <span className="font-mono text-xs text-text-secondary">{c.second_number || "—"}</span> },
            { key: "product_count", header: "Products", cell: (c: Company) => <span className="font-mono text-xs">{c.product_count ?? 0}</span> },
            {
              key: "actions", header: "", cell: (c: Company) => (
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => openEdit(c)} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(c.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
          data={filtered}
          loading={isLoading}
          keyExtractor={(c: Company) => c.id}
          emptyTitle="No companies found"
          emptyDescription={search ? `No companies match "${search}".` : "Add manufacturing companies and brands to map catalog products."}
          emptyAction={
            <Button onClick={openAdd} size="sm" className="h-9 rounded-xl text-xs gap-1.5 font-medium shadow-xs">
              <Plus className="h-3.5 w-3.5" /> Add Company
            </Button>
          }
        />
      ) : (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-surface p-8 shadow-xs">
              <EmptyState
                title="No companies found"
                description={search ? `No companies match "${search}". Try adjusting your search query.` : "Register your pharmaceutical manufacturing companies to organize products."}
                icon={<Building2 className="h-6 w-6 text-accent" />}
                action={
                  <Button onClick={openAdd} size="sm" className="h-9 rounded-xl text-xs gap-1.5 font-medium shadow-xs">
                    <Plus className="h-3.5 w-3.5" /> Add First Company
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((comp: Company) => (
                <div key={comp.id} className="group rounded-2xl border border-border/80 bg-surface p-5 shadow-xs hover:shadow-md hover:border-accent/30 transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-text-primary truncate text-sm">{comp.name}</h3>
                        <div className="space-y-1.5 mt-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                            <Phone className="h-3 w-3 shrink-0 text-text-secondary/70" />
                            <span className="font-mono">{comp.phone}</span>
                          </div>
                          {comp.second_number && (
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                              <Phone className="h-3 w-3 shrink-0 text-text-secondary/70" />
                              <span className="font-mono">{comp.second_number}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                            <Package className="h-3 w-3 shrink-0 text-text-secondary/70" />
                            <span>{comp.product_count ?? 0} products supplied</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => openEdit(comp)} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(comp.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingId(null); } setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Company" : "Add Company"}</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <Label>Company Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Company Contact</Label>
                <Input inputMode="numeric" pattern="[0-9]*" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })} />
              </div>
              <div>
                <Label>Contact #2</Label>
                <Input inputMode="numeric" pattern="[0-9]*" value={form.second_number} onChange={(e) => setForm({ ...form, second_number: e.target.value.replace(/\D/g, "").slice(0, 11) })} />
              </div>
            </div>
            <div>
              <Label>Address (optional)</Label>
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} className="flex w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 resize-none" />
            </div>
            <Button className="w-full" disabled={!form.name || createMutation.isPending || updateMutation.isPending}
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update Company" : "Add Company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Company"
        description="Are you sure you want to delete this company? Associated distributors will not be affected."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
