import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, Search, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatCard from "@/components/shared/StatCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { Expense } from "@/types";

const categories = ["All", "Utilities", "Salaries", "Supplies", "Rent"];

export default function Expenses() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", category: "Utilities", amount: "", notes: "", date: new Date().toISOString().split("T")[0] });

  const { data: expenses = [], isLoading } = useQuery({ queryKey: ["expenses"], queryFn: api.expenses.list });

  const filtered = expenses.filter((e: Expense) => {
    const catMatch = category === "All" || e.category === category;
    const searchMatch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.notes?.toLowerCase().includes(search.toLowerCase());
    return catMatch && searchMatch;
  });

  const totalThisMonth = expenses
    .filter((e: Expense) => e.date?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s: number, e: Expense) => s + e.amount, 0);

  const createMutation = useMutation({
    mutationFn: () => api.expenses.create({ title: form.title, category: form.category, amount: Number(form.amount), notes: form.notes, date: form.date }),
    onSuccess: () => {
      toast.success("Expense created");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false);
      setEditingId(null);
      setForm({ title: "", category: "Utilities", amount: "", notes: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.expenses.update(editingId!, { title: form.title, category: form.category, amount: Number(form.amount), notes: form.notes, date: form.date }),
    onSuccess: () => {
      toast.success("Expense updated");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false);
      setEditingId(null);
      setForm({ title: "", category: "Utilities", amount: "", notes: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.expenses.delete(id),
    onSuccess: () => {
      toast.success("Expense deleted");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  function openAdd() {
    setEditingId(null);
    setForm({ title: "", category: "Utilities", amount: "", notes: "", date: new Date().toISOString().split("T")[0] });
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({ title: e.title, category: e.category, amount: String(e.amount), notes: e.notes, date: e.date });
    setOpen(true);
  }

  const columns = [
    { key: "date", header: "Date", cell: (e: Expense) => <span className="font-mono text-xs text-text-secondary">{formatDate(e.date)}</span> },
    { key: "title", header: "Title", cell: (e: Expense) => <span className="font-medium text-text-primary">{e.title}</span> },
    { key: "category", header: "Category", cell: (e: Expense) => (
      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary font-medium">{e.category}</span>
    ) },
    { key: "amount", header: "Amount", cell: (e: Expense) => <span className="font-mono font-medium">{formatCurrency(e.amount)}</span> },
    { key: "notes", header: "Notes", cell: (e: Expense) => <span className="text-text-secondary text-xs">{e.notes || "—"}</span> },
    {
      key: "actions", header: "", cell: (e: Expense) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(e)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setDeleteId(e.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Expenses" description="Track and manage operational expenses" action={{ label: "Add Expense", onClick: openAdd }} />
      <div className="mb-6">
        <StatCard title="Total This Month" value={formatCurrency(totalThisMonth)} icon={<Wallet className="h-5 w-5" />} />
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {categories.map((cat) => (
          <Button key={cat} variant={category === cat ? "default" : "outline"} size="sm" onClick={() => setCategory(cat)}>{cat}</Button>
        ))}
      </div>
      <div className="rounded-xl border border-border">
        <DataTable columns={columns} data={filtered} loading={isLoading} keyExtractor={(e: Expense) => e.id} />
      </div>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingId(null); } setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c !== "All").map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div><Label>Notes (optional)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button className="w-full" disabled={!form.title || !form.amount || createMutation.isPending || updateMutation.isPending}
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update Expense" : "Add Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Expense"
        description="Are you sure you want to delete this expense?"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
