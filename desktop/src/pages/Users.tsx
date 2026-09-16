import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users as UsersIcon, Search, Plus, Pencil, Trash2, KeyRound, ShieldCheck, UserX, UserCheck, Store } from "lucide-react";
import { api } from "@/lib/api";
import { JOB_ROLES, JOB_ROLE_LABELS } from "@/types";
import type { Paginated, UserListItem, RoleListItem, UserInput, UpdateUserInput, Branch, JobRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/shared/PageHeader";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

interface TempResult {
  username: string;
  temporaryPassword: string;
}

export default function Users() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [temp, setTemp] = useState<TempResult | null>(null);
  const [tempAction, setTempAction] = useState<"created" | "reset" | null>(null);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [jobRole, setJobRole] = useState<JobRole | "">("");
  const [isActive, setIsActive] = useState(true);
  const [branchFilter, setBranchFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.list(),
  });
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: api.roles.list });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: api.branches.list });
  const { data: perms } = useQuery({ queryKey: ["permissions"], queryFn: api.permissions.list });

  const filtered = users.filter((u: UserListItem) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || (u.phone || "").toLowerCase().includes(q);
    const matchesRole = roleFilter === "all" || u.roleId === roleFilter || (u.roleName || "") === roleFilter;
    const matchesBranch = branchFilter === "all" || u.branchId === branchFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.isActive) ||
      (statusFilter === "inactive" && !u.isActive);
    return matchesSearch && matchesRole && matchesBranch && matchesStatus;
  });

  function resetForm() {
    setUsername("");
    setName("");
    setPhone("");
    setEmail("");
    setRoleId("");
    setBranchId("");
    setJobRole("");
    setIsActive(true);
  }

  function openAdd() {
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(u: UserListItem) {
    setEditingId(u.id);
    setUsername("");
    setName(u.name);
    setPhone(u.phone || "");
    setEmail(u.email || "");
    setRoleId(u.roleId || "");
    setBranchId(u.branchId || "");
    setJobRole((u.jobRole as JobRole) || "");
    setIsActive(u.isActive);
    setOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (input: UserInput) => api.users.create(input),
    onSuccess: (res) => {
      toast.success(`User created. Temporary password: ${res.temporaryPassword}`);
      setTemp({ username: res.user.username, temporaryPassword: res.temporaryPassword });
      setTempAction("created");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      api.users.update(id, input),
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.users.updateStatus(id, isActive),
    onSuccess: (u) => {
      toast.success(u.isActive ? "User activated" : "User deactivated");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => api.users.resetPassword(id),
    onSuccess: (res) => {
      toast.success(`Password reset. Temporary password: ${res.temporaryPassword}`);
      setTemp({ username: res.user.username, temporaryPassword: res.temporaryPassword });
      setTempAction("reset");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const branch = branchId || null;
    if (editingId) {
      const input: UpdateUserInput = { name, phone, email, roleId, branchId: branch, jobRole, isActive };
      updateMutation.mutate({ id: editingId, input });
    } else {
      const input: UserInput = { username, name, phone, email, roleId, branchId: branch, jobRole, isActive };
      createMutation.mutate(input);
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage system users, roles and access permissions"
        action={{ label: "Add User", onClick: openAdd }}
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            autoFocus
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r: RoleListItem) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            <SelectItem value="none">No branch</SelectItem>
            {branches.map((b: Branch) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-sm text-text-secondary">
            No users found. Set up your team to get started.
          </div>
        ) : (
          filtered.map((u: UserListItem) => (
            <Card key={u.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      {u.isActive ? <UsersIcon className="h-4 w-4 text-accent" /> : <UserX className="h-4 w-4 text-text-secondary" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm text-text-primary truncate">{u.name || u.username}</h3>
                      <p className="text-[11px] text-text-secondary truncate">@{u.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => resetMutation.mutate(u.id)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
                      title="Reset password"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { setEditingId(u.id); openEdit(u); }}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(u.id)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {u.roleName || "No role"}
                  </Badge>
                  {u.jobRole && (
                    <Badge variant="outline" className="text-[10px]">
                      {JOB_ROLE_LABELS[u.jobRole] || u.jobRole}
                    </Badge>
                  )}
                  {u.branchName && (
                    <Badge variant="outline" className="text-[10px]">
                      <Store className="h-3 w-3 mr-0.5" />
                      {u.branchName}
                    </Badge>
                  )}
                  <Badge
                    variant={u.isActive ? "success" : "neutral"}
                    className="text-[10px]"
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {perms && (u.permissions?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      <ShieldCheck className="h-3 w-3 mr-0.5" />
                      {u.permissions?.length} perms
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary">
                    Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "never"}
                  </span>
                  <button
                    onClick={() => statusMutation.mutate({ id: u.id, isActive: !u.isActive })}
                    className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-accent transition-colors"
                  >
                    {u.isActive ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditingId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit User" : "Add User"}</DialogTitle>
            {!editingId && (
              <DialogDescription>
                A temporary password will be generated. The user can change it anytime from the sidebar.
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingId && (
              <div className="space-y-1.5">
                <Label htmlFor="user-username" className="text-xs">Username</Label>
                <Input
                  id="user-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. cashier1"
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="user-name" className="text-xs">Full Name</Label>
              <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Ali" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="user-phone" className="text-xs">Phone</Label>
                <Input id="user-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xxxxxxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email" className="text-xs">Email</Label>
                <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-role" className="text-xs">Role</Label>
              <Select value={roleId || undefined} onValueChange={setRoleId} required>
                <SelectTrigger id="user-role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: RoleListItem) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="user-branch" className="text-xs">Branch</Label>
                <Select value={branchId || undefined} onValueChange={setBranchId}>
                  <SelectTrigger id="user-branch"><SelectValue placeholder="No branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: Branch) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-jobrole" className="text-xs">Job Role</Label>
                <Select value={jobRole || undefined} onValueChange={(v) => setJobRole((v as JobRole) || "")}>
                  <SelectTrigger id="user-jobrole"><SelectValue placeholder="Not assigned" /></SelectTrigger>
                  <SelectContent>
                    {JOB_ROLES.map((jr) => (
                      <SelectItem key={jr} value={jr}>{JOB_ROLE_LABELS[jr]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="user-active"
                checked={isActive}
                onCheckedChange={(v) => setIsActive(!!v)}
              />
              <Label htmlFor="user-active" className="text-xs">Account is active</Label>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                (editingId ? false : !username.trim() || !name.trim() || !roleId)
              }
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Create User"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!temp} onOpenChange={(v) => { if (!v) { setTemp(null); setTempAction(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User {tempAction === "reset" ? "Password Reset" : "Created"}</DialogTitle>
            <DialogDescription>
              Share the temporary password with the user. They can change it anytime from the sidebar.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary mb-1">Username</p>
            <p className="text-sm font-mono font-medium text-text-primary">{temp?.username}</p>
            <p className="text-xs text-text-secondary mt-3 mb-1">Temporary Password</p>
            <p className="text-sm font-mono font-medium text-accent break-all">{temp?.temporaryPassword}</p>
          </div>
          <Button className="w-full" onClick={() => { setTemp(null); setTempAction(null); }}>
            Done
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete User"
        description="This will delete the user account. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
