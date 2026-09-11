import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, Phone, MapPin, Pencil, Trash2, Download, Lock, AlertTriangle, LayoutGrid, List } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { Customer } from "@/types";

export default function Customers() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [forceDeleteOpen, setForceDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<{ salesCount: number; arrearsCount: number } | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers.list,
  });

  const createMutation = useMutation({
    mutationFn: () => api.customers.create({ name, phone, address, fatherName, fatherPhone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setName("");
      setPhone("");
      setAddress("");
      setFatherName("");
      setFatherPhone("");
      toast.success("Customer created");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.customers.update(editingId!, { name, phone, address, fatherName, fatherPhone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setEditingId(null);
      setName("");
      setPhone("");
      setAddress("");
      setFatherName("");
      setFatherPhone("");
      toast.success("Customer updated");
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

  const filtered = customers.filter((c: Customer) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || (c.father_name ?? "").toLowerCase().includes(search.toLowerCase()) || (c.father_phone ?? "").includes(search)
  );

  function openAdd() {
    setEditingId(null);
    setName("");
    setPhone("");
    setAddress("");
    setFatherName("");
    setFatherPhone("");
    setOpen(true);
  }

  useEffect(() => {
    if ((location.state as { openNew?: boolean } | null)?.openNew) {
      openAdd();
      window.history.replaceState({}, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setAddress(c.address);
    setFatherName(c.father_name ?? "");
    setFatherPhone(c.father_phone ?? "");
    setOpen(true);
  }

  const columns = [
    { key: "name", header: "Name", cell: (c: Customer) => <span className="font-medium text-text-primary">{c.name}</span> },
    { key: "phone", header: "Phone", cell: (c: Customer) => <span className="font-mono text-xs text-text-secondary">{c.phone}</span> },
    { key: "father", header: "Father", cell: (c: Customer) => (
      <span className="text-xs text-text-secondary truncate max-w-[220px] inline-block">
        {c.father_name ? c.father_name : "\u2014"}
        {c.father_phone ? ` \u00b7 ${c.father_phone}` : ""}
      </span>
    ) },
    { key: "address", header: "Address", cell: (c: Customer) => <span className="text-xs text-text-secondary truncate max-w-[180px] inline-block">{c.address || "\u2014"}</span> },
    { key: "total_purchases", header: "Purchases", cell: (c: Customer) => <span className="font-mono font-medium">{c.total_purchases ?? 0}</span> },
    { key: "outstanding_arrear", header: "Arrear", cell: (c: Customer) => {
      const arrear = c.outstanding_arrear ?? 0;
      return (
        <span className={`font-mono font-medium ${arrear > 0 ? "text-warning" : "text-text-secondary"}`}>
          {arrear > 0 ? formatCurrency(arrear) : "—"}
        </span>
      );
    } },
    { key: "last_purchase", header: "Last Purchase", cell: (c: Customer) => (
      <span className="text-xs text-text-secondary">{c.last_purchase ? formatDate(c.last_purchase) : "—"}</span>
    ) },
    {
      key: "actions", header: "", cell: (c: Customer) => (
        <div className="flex items-center gap-1 justify-end">
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
    <div>
      <PageHeader title="Customers" description="Manage your customer relationships" action={{ label: "Add Customer", onClick: openAdd }} />
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input autoFocus placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCSV(`customers_${new Date().toISOString().split("T")[0]}.csv`, ["Name","Phone","Father Name","Father Phone","Address","Purchases","Arrear","Last Purchase"], filtered.map((c: Customer) => [c.name, c.phone, c.father_name||"", c.father_phone||"", c.address, c.total_purchases||0, c.outstanding_arrear||0, c.last_purchase||""]))}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadPDF(`customers_${new Date().toISOString().split("T")[0]}.pdf`, "Customers List", ["Name","Phone","Father Name","Father Phone","Address","Purchases","Arrear","Last Purchase"], filtered.map((c: Customer) => [c.name, c.phone, c.father_name||"", c.father_phone||"", c.address, c.total_purchases||0, c.outstanding_arrear||0, c.last_purchase||""]))}>
          <Download className="h-4 w-4 mr-1" /> PDF
        </Button>
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("grid")} className={cn("p-2 transition-colors", viewMode === "grid" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-2")}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={cn("p-2 transition-colors", viewMode === "list" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-2")}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
      {viewMode === "list" ? (
        <div className="rounded-xl border border-border">
          <DataTable
            columns={columns}
            data={filtered}
            loading={isLoading}
            keyExtractor={(c: Customer) => c.id}
            onRowClick={(c: Customer) => navigate(`/customers/${c.id}`)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-surface-2 animate-pulse" />)
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-sm text-text-secondary">
              {search ? "No customers match your search" : "No customers yet."}
            </div>
          ) : (
            filtered.map((c: Customer) => (
              <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Phone className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-text-primary truncate">{c.name}</h3>
                      <p className="text-xs text-text-secondary mt-0.5">{c.phone}</p>
                      {(c.father_name || c.father_phone) && (
                        <p className="text-[11px] text-text-secondary mt-0.5 truncate">
                          Father: {c.father_name || "\u2014"}{c.father_phone ? ` \u00b7 ${c.father_phone}` : ""}
                        </p>
                      )}
                      {c.address && <p className="flex items-center gap-1 text-[11px] text-text-secondary mt-1"><MapPin className="h-3 w-3 shrink-0" />{c.address}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-text-secondary">Purchases: <span className="font-mono font-medium text-text-primary">{c.total_purchases ?? 0}</span></span>
                        {(c.outstanding_arrear ?? 0) > 0 && (
                          <span className="text-warning">Arrear: <span className="font-mono font-medium">{formatCurrency(c.outstanding_arrear)}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(c); }} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
      <Dialog open={forceDeleteOpen} onOpenChange={(v) => { if (!v) { setForceDeleteOpen(false); setDeleteTarget(null); setDeleteInfo(null); setAdminPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Force Delete Customer
            </DialogTitle>
            <DialogDescription>
              This customer has existing records. Deleting will permanently remove their data.
            </DialogDescription>
          </DialogHeader>
          {deleteInfo && (
            <div className="px-5 pb-5 space-y-2 text-sm">
              <p className="font-medium text-text-primary">{deleteTarget?.name}</p>
              <ul className="space-y-1 text-text-secondary">
                {deleteInfo.salesCount > 0 && <li>• {deleteInfo.salesCount} invoice(s) — customer reference will be removed</li>}
                {deleteInfo.arrearsCount > 0 && <li>• {deleteInfo.arrearsCount} arrear(s) — will be permanently deleted</li>}
              </ul>
              <div className="pt-2 space-y-2">
                <Label className="flex items-center gap-2"><Lock className="h-4 w-4" /> Enter admin password to confirm</Label>
                <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" />
              </div>
              <Button className="w-full mt-2" variant="destructive" disabled={!adminPassword || forceDeleteMutation.isPending}
                onClick={() => forceDeleteMutation.mutate()}>
                {forceDeleteMutation.isPending ? "Deleting..." : "Force Delete"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingId(null); } setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Father Name</Label>
              <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
            </div>
            <div>
              <Label>Father Phone No</Label>
              <Input value={fatherPhone} onChange={(e) => setFatherPhone(e.target.value)} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <Button className="w-full" disabled={!name || createMutation.isPending || updateMutation.isPending}
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update Customer" : "Add Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Customer"
        description="Are you sure you want to delete this customer?"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
