import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tags, Search, Plus, Pencil, Trash2, Download, FolderTree, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { Category } from "@/types";

export default function Categories() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const { data: categories = [], isLoading } = useQuery({ queryKey: ["categories"], queryFn: api.categories.list });

  const filtered = categories.filter((c: Category) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: () => api.categories.create({ name }),
    onSuccess: () => {
      toast.success("Category created");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
      setName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.categories.update(editingId!, { name }),
    onSuccess: () => {
      toast.success("Category updated");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
      setEditingId(null);
      setName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.categories.delete(id),
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  function openAdd() {
    setEditingId(null);
    setName("");
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditingId(c.id);
    setName(c.name);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drug & Product Categories"
        description="Organize medication inventory into therapeutic classifications, departments, and retail segments."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-accent/10 text-accent font-semibold border border-accent/20">
            {categories.length} Categories
          </span>
        }
        action={{ label: "Add Category", onClick: openAdd, icon: <Plus className="h-3.5 w-3.5" /> }}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Categories"
          value={categories.length}
          icon={<Tags className="h-5 w-5" />}
          color="accent"
          loading={isLoading}
          subtitle="Active catalog segments"
        />
        <StatCard
          title="Active Classifications"
          value={filtered.length}
          icon={<FolderTree className="h-5 w-5" />}
          color="purple"
          loading={isLoading}
          subtitle={search ? `Matching "${search}"` : "Therapeutic groups"}
        />
        <StatCard
          title="Taxonomy Status"
          value="Standardized"
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="success"
          subtitle="Catalog taxonomy active"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-border/80 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            placeholder="Search category name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl text-xs bg-surface-2/40 border-border/80 focus:bg-surface"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            onClick={() => downloadCSV(`categories_${new Date().toISOString().split("T")[0]}.csv`, ["Name"], filtered.map((c: Category) => [c.name]))}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2"
            onClick={() => downloadPDF(`categories_${new Date().toISOString().split("T")[0]}.pdf`, "Categories List", ["Name"], filtered.map((c: Category) => [c.name]))}
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-surface p-8 shadow-xs">
          <EmptyState
            title="No categories found"
            description={search ? `No categories match "${search}". Try adjusting your search query.` : "Create categories such as Antibiotics, Analgesics, or Supplements to organize medicines."}
            icon={<Tags className="h-6 w-6 text-accent" />}
            action={
              <Button onClick={openAdd} size="sm" className="h-9 rounded-xl text-xs gap-1.5 font-medium shadow-xs">
                <Plus className="h-3.5 w-3.5" /> Add First Category
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cat: Category) => (
            <div
              key={cat.id}
              className="group rounded-2xl border border-border/80 bg-surface p-4 shadow-xs hover:shadow-md hover:border-accent/30 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                  <Tags className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-text-primary truncate">{cat.name}</h3>
                  <p className="text-[11px] text-text-secondary mt-0.5">Therapeutic classification</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => openEdit(cat)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteId(cat.id)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingId(null); } setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Category Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tablets, Syrups, Injections"
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update Category" : "Add Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Category"
        description="Are you sure you want to delete this category? Products assigned to it will not be affected."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
