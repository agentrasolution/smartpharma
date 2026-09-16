import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { Permission, RoleListItem, RoleInput } from "@/types";

const PERMISSION_GROUPS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "products", label: "Products" },
  { key: "stock", label: "Stock & Purchases" },
  { key: "sales", label: "Sales & Returns" },
  { key: "customers", label: "Customers & Arrears" },
  { key: "returns", label: "Returns" },
  { key: "distributors", label: "Distributors" },
  { key: "expenses", label: "Expenses" },
  { key: "reports", label: "Reports" },
  { key: "users", label: "Users (RBAC)" },
  { key: "branches", label: "Branches" },
  { key: "settings", label: "Settings" },
];

export default function Roles() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: roles = [], isLoading } = useQuery({ queryKey: ["roles"], queryFn: api.roles.list });
  const { data: permissions = [] } = useQuery({ queryKey: ["permissions"], queryFn: api.permissions.list });

  const filtered = roles.filter((r: RoleListItem) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditingId(null);
    setName("");
    setDescription("");
    setSelected([]);
    setOpen(true);
  }

  function openEdit(role: RoleListItem) {
    setEditingId(role.id);
    setName(role.name);
    setDescription(role.description ?? "");
    setSelected((role.permissions ?? []).map((p: Permission) => p.name));
    setOpen(true);
  }

  function togglePermission(name: string) {
    setSelected((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: RoleInput = { name, description, permissionNames: selected };
    if (editingId) updateMutation.mutate({ id: editingId, input });
    else createMutation.mutate(input);
  }

  const createMutation = useMutation({
    mutationFn: (input: RoleInput) => api.roles.create(input),
    onSuccess: () => {
      toast.success("Role created");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RoleInput }) => api.roles.update(id, input),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.roles.remove(id),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setDeleteId(null);
    },
    onError: (err: Error) => { toast.error(err.message); setDeleteId(null); },
  });

  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Create and manage roles and their access permissions" />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button className="absolute inset-y-0 right-0" size="sm" variant="ghost" disabled>
            <KeyRound className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> New Role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-sm text-text-secondary">
            {search ? "No roles match your search" : "No roles yet. Create your first role to start."}
          </div>
        ) : (
          filtered.map((role: RoleListItem) => (
            <Card key={role.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm text-text-primary truncate">{role.name}</h3>
                      <p className="text-[11px] text-text-secondary truncate">
                        {role.userCount ?? 0} user{(role.userCount ?? 0) === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(role)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(role.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-text-secondary mt-2 line-clamp-2">{role.description || "No description"}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {(role.permissions ?? []).slice(0, 6).map((p: Permission) => (
                    <span key={p.name} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-secondary border border-border">
                      {p.name}
                    </span>
                  ))}
                  {(role.permissions ?? []).length > 6 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-secondary">
                      +{(role.permissions ?? []).length - 6}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Role" : "New Role"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="role-name" className="text-xs">Role Name</Label>
                <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Cashier" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-desc" className="text-xs">Description</Label>
                <Input id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role can do" />
              </div>
            </div>

            <div className="border rounded-lg divide-y divide-border max-h-80 overflow-y-auto">
              {PERMISSION_GROUPS.map((group) => {
                const groupPerms = permissions.filter((p: Permission) => p.name.startsWith(`${group.key}.`));
                if (groupPerms.length === 0) return null;
                const allChecked = groupPerms.every((p: Permission) => selected.includes(p.name));
                const someChecked = groupPerms.some((p: Permission) => selected.includes(p.name));
                return (
                  <div key={group.key} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-medium text-text-primary cursor-pointer">
                        <Checkbox
                          checked={allChecked ? true : someChecked ? "indeterminate" : false}
                          onCheckedChange={() => {
                            groupPerms.forEach((p: Permission) => togglePermission(p.name));
                          }}
                        />
                        {group.label}
                      </label>
                      <span className="text-[10px] text-text-secondary">{groupPerms.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2 pl-6">
                      {groupPerms.map((p: Permission) => (
                        <label key={p.name} className={cn(
                          "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border cursor-pointer transition-colors",
                          selected.includes(p.name)
                            ? "border-accent/30 bg-accent/10 text-text-primary"
                            : "border-border bg-surface text-text-secondary hover:bg-surface-2"
                        )}>
                          <Checkbox
                            checked={selected.includes(p.name)}
                            onCheckedChange={() => togglePermission(p.name)}
                            className="h-3 w-3"
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">{selected.length} permission{selected.length === 1 ? "" : "s"} selected</span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Create Role"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Role"
        description="Are you sure you want to delete this role? Users assigned to it will no longer inherit its permissions."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
