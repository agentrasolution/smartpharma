import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, Plus, Pencil, Trash2, Phone, Users2, UserCheck, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { JOB_ROLE_LABELS } from "@/types";
import type { Branch, BranchInput } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/shared/PageHeader";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

const JOB_STATS = [
  { key: "salesmanCount", label: "Salesmen" },
  { key: "cashierCount", label: "Cashiers" },
  { key: "helperCount", label: "Helpers" },
  { key: "stockManagerCount", label: "Stock Mgrs" },
  { key: "managerCount", label: "Managers" },
  { key: "adminCount", label: "Admins" },
] as const;

export default function Branches() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: api.branches.list,
  });

  const filtered = branches.filter((b: Branch) =>
    !search ||
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.address.toLowerCase().includes(search.toLowerCase())
  );

  function resetForm() {
    setName("");
    setAddress("");
    setPhone("");
    setIsActive(true);
  }

  function openAdd() {
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(b: Branch) {
    setEditingId(b.id);
    setName(b.name);
    setAddress(b.address || "");
    setPhone(b.phone || "");
    setIsActive(b.isActive);
    setOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (input: BranchInput) => api.branches.create(input),
    onSuccess: () => {
      toast.success("Branch created");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: BranchInput }) =>
      api.branches.update(id, input),
    onSuccess: () => {
      toast.success("Branch updated");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.branches.remove(id),
    onSuccess: () => {
      toast.success("Branch deleted");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setDeleteId(null);
    },
    onError: (err: Error) => { toast.error(err.message); setDeleteId(null); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: BranchInput = { name, address, phone, isActive };
    if (editingId) updateMutation.mutate({ id: editingId, input });
    else createMutation.mutate(input);
  }

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Manage pharmacy branches and their assigned staff"
        action={{ label: "Add Branch", onClick: openAdd }}
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Input
            autoFocus
            placeholder="Search branches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-sm text-text-secondary">
            {search ? "No branches match your search" : "No branches yet. Add your first pharmacy branch to get started."}
          </div>
        ) : (
          filtered.map((b: Branch) => (
            <Card key={b.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Store className="h-4 w-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm text-text-primary truncate">{b.name}</h3>
                      <p className="text-[11px] text-text-secondary truncate">{b.address || "No address"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(b)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(b.id)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={b.isActive ? "success" : "neutral"} className="text-[10px]">
                    {b.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Users2 className="h-3 w-3 mr-0.5" />
                    {b.userCount} staff
                  </Badge>
                  {b.phone && (
                    <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                      <Phone className="h-3 w-3" />
                      {b.phone}
                    </span>
                  )}
                </div>

                {b.userCount > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {JOB_STATS.filter((s) => b[s.key] > 0).map((s) => (
                      <div key={s.key} className="flex items-center justify-between text-[11px]">
                        <span className="text-text-secondary">{s.label}</span>
                        <span className="font-medium text-text-primary">{b[s.key]}</span>
                      </div>
                    ))}
                  </div>
                )}

                {b.userCount > 0 && (
                  <div className="mt-3 pt-2 border-t border-border space-y-1">
                    {b.users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-text-primary truncate">{u.name || u.username}</span>
                        <span className="flex items-center gap-1 text-text-secondary shrink-0">
                          {JOB_ROLE_LABELS[u.jobRole] || u.jobRole || "—"}
                          {u.isActive ? (
                            <UserCheck className="h-3 w-3 text-success" />
                          ) : (
                            <UserX className="h-3 w-3 text-danger" />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditingId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="branch-name" className="text-xs">Branch Name</Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gulberg Main Branch"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-address" className="text-xs">Address</Label>
              <Input
                id="branch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Main Market, Gulberg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-phone" className="text-xs">Phone</Label>
              <Input
                id="branch-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 03xxxxxxxxx"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="branch-active"
                checked={isActive}
                onCheckedChange={(v) => setIsActive(!!v)}
              />
              <Label htmlFor="branch-active" className="text-xs">Branch is active</Label>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Create Branch"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Branch"
        description="Are you sure you want to delete this branch? Only branches with no assigned staff can be deleted."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}