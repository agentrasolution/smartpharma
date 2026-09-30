import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Store, Plus, Pencil, Trash2, Phone, Users2, UserCheck, UserX,
  ArrowLeftRight, Send, CheckCircle2, XCircle, Search,
  Tag, Clock, PackageCheck, Layers, ChevronDown, ChevronUp, AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { JOB_ROLE_LABELS } from "@/types";
import type {
  Branch, BranchInput, StockTransfer, CreateTransferInput,
  CrossBranchStockResponse, BranchPriceOverride
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Active tab state
  const [activeTab, setActiveTab] = useState<"branches" | "transfers" | "cross-stock">("branches");

  // Branch CRUD state
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [allowPriceOverride, setAllowPriceOverride] = useState(true);

  // Price overrides modal state
  const [priceOverrideBranch, setPriceOverrideBranch] = useState<Branch | null>(null);
  const [newOverrideProductId, setNewOverrideProductId] = useState("");
  const [newOverridePrice, setNewOverridePrice] = useState("");
  const [newOverrideReason, setNewOverrideReason] = useState("");

  // Transfers state
  const [transferFilterStatus, setTransferFilterStatus] = useState<string>("all");
  const [transferFilterDirection, setTransferFilterDirection] = useState<"all" | "in" | "out">("all");
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [selectedTransferForDetail, setSelectedTransferForDetail] = useState<StockTransfer | null>(null);
  const [rejectDialogTransferId, setRejectDialogTransferId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Transfer form fields
  const [transferSourceBranchId, setTransferSourceBranchId] = useState("");
  const [transferDestBranchId, setTransferDestBranchId] = useState("");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [transferNotes, setTransferNotes] = useState("");
  const [transferSendImmediately, setTransferSendImmediately] = useState(true);

  // Cross Branch Stock state
  const [crossStockQuery, setCrossStockQuery] = useState("");
  const [expandedBranchBatchId, setExpandedBranchBatchId] = useState<string | null>(null);

  // Queries
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: api.branches.list,
  });

  const { data: transfersData, isLoading: isTransfersLoading } = useQuery({
    queryKey: ["transfers", transferFilterStatus, transferFilterDirection],
    queryFn: () =>
      api.transfers.list({
        status: transferFilterStatus === "all" ? undefined : transferFilterStatus,
        direction: transferFilterDirection === "all" ? undefined : transferFilterDirection,
      }),
  });
  const transfers = transfersData?.data ?? [];

  // Products query for selectors
  const { data: productsData } = useQuery({
    queryKey: ["products-lookup"],
    queryFn: () => api.products.list(),
  });
  const availableProducts = productsData?.data ?? [];

  // Overrides query for currently selected branch
  const { data: branchOverridesData } = useQuery({
    queryKey: ["branch-overrides", priceOverrideBranch?.id],
    queryFn: () => (priceOverrideBranch ? api.branches.getPriceOverrides(priceOverrideBranch.id) : null),
    enabled: !!priceOverrideBranch,
  });
  const currentOverrides = branchOverridesData?.overrides ?? [];

  // Cross branch stock query
  const { data: crossStockResult, isFetching: isSearchingCrossStock, refetch: executeCrossStockSearch } = useQuery({
    queryKey: ["cross-branch-stock", crossStockQuery],
    queryFn: () => api.branches.crossStock({ barcode: crossStockQuery, productId: crossStockQuery }),
    enabled: false,
  });

  // Branch mutations
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
    onError: (err: Error) => toast.error(err.message),
  });

  // Transfer mutations
  const createTransferMutation = useMutation({
    mutationFn: (input: CreateTransferInput) => api.transfers.create(input),
    onSuccess: (data) => {
      toast.success(
        data.status === "IN_TRANSIT"
          ? `Transfer ${data.transferNumber} dispatched and in-transit!`
          : `Transfer request ${data.transferNumber} created!`,
      );
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      setIsNewTransferOpen(false);
      resetTransferForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendTransferMutation = useMutation({
    mutationFn: (id: string) => api.transfers.send(id),
    onSuccess: (data) => {
      toast.success(`Transfer ${data.transferNumber} dispatched! Source stock decremented.`);
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      if (selectedTransferForDetail) setSelectedTransferForDetail(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const receiveTransferMutation = useMutation({
    mutationFn: (id: string) => api.transfers.receive(id),
    onSuccess: (data) => {
      toast.success(
        `Transfer ${data.transferNumber} received! Stock & batches imported with preserved expiry dates & costs.`,
      );
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      if (selectedTransferForDetail) setSelectedTransferForDetail(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectTransferMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.transfers.reject(id, reason),
    onSuccess: (data) => {
      toast.info(`Transfer ${data.transferNumber} rejected. If dispatched, source stock has been restored.`);
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      setRejectDialogTransferId(null);
      setRejectReason("");
      if (selectedTransferForDetail) setSelectedTransferForDetail(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Price override mutations
  const setOverrideMutation = useMutation({
    mutationFn: ({ branchId, input }: { branchId: string; input: { productId: string; salePrice: number; reason?: string } }) =>
      api.branches.setPriceOverride(branchId, input),
    onSuccess: () => {
      toast.success("Branch price override saved");
      queryClient.invalidateQueries({ queryKey: ["branch-overrides", priceOverrideBranch?.id] });
      setNewOverrideProductId("");
      setNewOverridePrice("");
      setNewOverrideReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: ({ branchId, productId }: { branchId: string; productId: string }) =>
      api.branches.deletePriceOverride(branchId, productId),
    onSuccess: () => {
      toast.success("Price override removed. Branch reverted to catalog price.");
      queryClient.invalidateQueries({ queryKey: ["branch-overrides", priceOverrideBranch?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetForm() {
    setName("");
    setAddress("");
    setPhone("");
    setIsActive(true);
    setAllowPriceOverride(true);
  }

  function resetTransferForm() {
    setTransferSourceBranchId("");
    setTransferDestBranchId("");
    setTransferProductId("");
    setTransferQuantity(1);
    setTransferNotes("");
    setTransferSendImmediately(true);
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
    setAllowPriceOverride(b.allowPriceOverride ?? true);
    setOpen(true);
  }

  function handleBranchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        input: { name: name.trim(), address: address.trim(), phone: phone.trim(), isActive, allowPriceOverride },
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        isActive,
        allowPriceOverride,
      });
    }
  }

  function handleCreateTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferSourceBranchId || !transferDestBranchId || !transferProductId || transferQuantity < 1) {
      toast.error("Please fill in all required transfer fields");
      return;
    }
    if (transferSourceBranchId === transferDestBranchId) {
      toast.error("Source and destination branch cannot be the same");
      return;
    }

    createTransferMutation.mutate({
      sourceBranchId: transferSourceBranchId,
      destinationBranchId: transferDestBranchId,
      notes: transferNotes,
      sendImmediately: transferSendImmediately,
      items: [{ productId: transferProductId, quantity: Number(transferQuantity) }],
    });
  }

  function handleAddPriceOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!priceOverrideBranch || !newOverrideProductId || !newOverridePrice) return;
    const priceNum = parseFloat(newOverridePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setOverrideMutation.mutate({
      branchId: priceOverrideBranch.id,
      input: {
        productId: newOverrideProductId,
        salePrice: priceNum,
        reason: newOverrideReason.trim() || undefined,
      },
    });
  }

  const filtered = branches.filter((b: Branch) =>
    !search ||
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Multi-Branch Operations"
        subtitle="Manage pharmacy network, branch price rules, and inter-branch stock transfers"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "transfers" && (
              <Button
                onClick={() => {
                  resetTransferForm();
                  if (branches.length >= 2) {
                    setTransferSourceBranchId(branches[0].id);
                    setTransferDestBranchId(branches[1].id);
                  }
                  setIsNewTransferOpen(true);
                }}
                className="gap-2 bg-primary text-white"
              >
                <Plus className="h-4 w-4" />
                New Transfer
              </Button>
            )}
            {activeTab === "branches" && (
              <Button onClick={openAdd} className="gap-2 bg-primary text-white">
                <Plus className="h-4 w-4" />
                Add Branch
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-xl bg-surface-2 p-1 rounded-xl">
          <TabsTrigger value="branches" className="gap-2">
            <Store className="h-4 w-4" />
            Branches & Staff
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Stock Transfers
            {transfers.filter((t) => t.status === "IN_TRANSIT" || t.status === "PENDING").length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-primary text-white rounded-full">
                {transfers.filter((t) => t.status === "IN_TRANSIT" || t.status === "PENDING").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cross-stock" className="gap-2">
            <Layers className="h-4 w-4" />
            Cross-Branch Stock
          </TabsTrigger>
        </TabsList>

        {/* =================================================================== */}
        {/* TAB 1: BRANCHES & PRICING RULES                                     */}
        {/* =================================================================== */}
        <TabsContent value="branches" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search branches by name or address..."
                className="pl-9"
              />
            </div>
            <div className="text-xs text-text-secondary">
              Total Branches: <span className="font-semibold text-text-primary">{branches.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="bg-surface border-border">
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-12 text-center text-text-secondary">
                {search ? "No branches match your search" : "No branches configured yet."}
              </div>
            ) : (
              filtered.map((b: Branch) => (
                <Card
                  key={b.id}
                  className="bg-surface border-border hover:border-primary/40 transition-colors shadow-sm"
                >
                  <CardContent className="p-5 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Store className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-text-primary text-base leading-tight">{b.name}</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge
                                variant={b.isActive ? "default" : "secondary"}
                                className={`text-[10px] px-1.5 py-0 ${b.isActive ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : ""}`}
                              >
                                {b.isActive ? "Active" : "Inactive"}
                              </Badge>
                              {b.allowPriceOverride ? (
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                                  Custom Prices Enabled
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-text-secondary">
                                  Central Pricing Only
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-text-secondary hover:text-text-primary"
                            onClick={() => openEdit(b)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-text-secondary hover:text-danger"
                            onClick={() => setDeleteId(b.id)}
                            disabled={b.userCount > 0}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1 text-xs text-text-secondary">
                        {b.address && <p className="truncate">{b.address}</p>}
                        {b.phone && (
                          <p className="flex items-center gap-1 text-[11px]">
                            <Phone className="h-3 w-3" />
                            {b.phone}
                          </p>
                        )}
                      </div>

                      {/* Staff summary */}
                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-text-secondary">
                          <Users2 className="h-3.5 w-3.5" /> Assigned Staff
                        </span>
                        <span className="font-semibold text-text-primary">{b.userCount}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs gap-1.5 h-8"
                        onClick={() => setPriceOverrideBranch(b)}
                        disabled={!b.allowPriceOverride}
                      >
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        Price Overrides
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 2: INTER-BRANCH TRANSFERS                                       */}
        {/* =================================================================== */}
        <TabsContent value="transfers" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Status:</span>
              <div className="flex items-center gap-1">
                {["all", "PENDING", "IN_TRANSIT", "RECEIVED", "REJECTED"].map((st) => (
                  <Button
                    key={st}
                    variant={transferFilterStatus === st ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2.5 rounded-lg"
                    onClick={() => setTransferFilterStatus(st)}
                  >
                    {st === "all" ? "All Statuses" : st.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Direction:</span>
              <div className="flex items-center gap-1">
                {(["all", "out", "in"] as const).map((dir) => (
                  <Button
                    key={dir}
                    variant={transferFilterDirection === dir ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2.5 rounded-lg"
                    onClick={() => setTransferFilterDirection(dir)}
                  >
                    {dir === "all" ? "All" : dir === "out" ? "Outgoing Sent" : "Incoming Received"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isTransfersLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="bg-surface border-border p-4">
                  <Skeleton className="h-6 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </Card>
              ))
            ) : transfers.length === 0 ? (
              <div className="py-16 text-center text-text-secondary bg-surface border border-border rounded-xl">
                <ArrowLeftRight className="h-10 w-10 mx-auto text-text-secondary/40 mb-3" />
                <p className="font-medium text-text-primary">No stock transfers found</p>
                <p className="text-xs mt-1">Create a transfer request to move inventory between branches with automated batch travel.</p>
              </div>
            ) : (
              transfers.map((t) => {
                const isPending = t.status === "PENDING";
                const isInTransit = t.status === "IN_TRANSIT";
                const isReceived = t.status === "RECEIVED";
                const isRejected = t.status === "REJECTED";

                return (
                  <Card
                    key={t.id}
                    className="bg-surface border-border hover:border-primary/30 transition-all p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm text-text-primary">{t.transferNumber}</span>
                        <Badge
                          variant="outline"
                          className={
                            isPending
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : isInTransit
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20 font-semibold"
                              : isReceived
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          }
                        >
                          {t.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-text-secondary">
                          {new Date(t.createdAt).toLocaleDateString()} at {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">{t.sourceBranch?.name || "Source"}</span>
                        <ArrowLeftRight className="h-3 w-3 text-primary shrink-0" />
                        <span className="font-medium text-text-primary">{t.destinationBranch?.name || "Destination"}</span>
                        <span className="text-border">|</span>
                        <span>{t.items?.length || 0} line item(s)</span>
                        {t.requestedByName && <span>· Req by: {t.requestedByName}</span>}
                        {t.approvedByName && <span>· Sent by: {t.approvedByName}</span>}
                        {t.receivedByName && <span>· Received by: {t.receivedByName}</span>}
                      </div>

                      {t.rejectionReason && (
                        <p className="text-xs text-rose-600 bg-rose-500/10 px-2 py-1 rounded inline-block">
                          Rejection Reason: {t.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setSelectedTransferForDetail(t)}
                      >
                        View Items
                      </Button>

                      {isPending && (
                        <Button
                          size="sm"
                          className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1"
                          onClick={() => sendTransferMutation.mutate(t.id)}
                          disabled={sendTransferMutation.isPending}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Approve & Send
                        </Button>
                      )}

                      {isInTransit && (
                        <>
                          <Button
                            size="sm"
                            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            onClick={() => receiveTransferMutation.mutate(t.id)}
                            disabled={receiveTransferMutation.isPending}
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            Receive Stock
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs h-8 gap-1"
                            onClick={() => {
                              setRejectDialogTransferId(t.id);
                              setRejectReason("");
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 3: CROSS-BRANCH STOCK FINDER                                    */}
        {/* =================================================================== */}
        <TabsContent value="cross-stock" className="space-y-4 mt-4">
          <Card className="bg-surface border-border">
            <CardContent className="p-6 space-y-4">
              <div className="max-w-xl space-y-1">
                <h3 className="font-semibold text-base text-text-primary">Cross-Branch Stock Visibility</h3>
                <p className="text-xs text-text-secondary">
                  Look up any medicine by barcode or drug ID to see real-time on-hand stock and active batches across all pharmacy branches.
                </p>
              </div>

              <div className="flex gap-2 max-w-xl">
                <Input
                  value={crossStockQuery}
                  onChange={(e) => setCrossStockQuery(e.target.value)}
                  placeholder="Enter barcode or drug identifier (e.g. 628100001)..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && crossStockQuery.trim()) {
                      executeCrossStockSearch();
                    }
                  }}
                />
                <Button
                  onClick={() => executeCrossStockSearch()}
                  disabled={!crossStockQuery.trim() || isSearchingCrossStock}
                  className="bg-primary text-white gap-1.5 shrink-0"
                >
                  <Search className="h-4 w-4" />
                  {isSearchingCrossStock ? "Searching..." : "Lookup Stock"}
                </Button>
              </div>

              {crossStockResult && (
                <div className="mt-6 pt-6 border-t border-border space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface-2 rounded-xl border border-border">
                    <div>
                      <h4 className="font-bold text-lg text-text-primary">{crossStockResult.productName}</h4>
                      <p className="text-xs text-text-secondary font-mono">Barcode: {crossStockResult.barcode}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-secondary">Total Network Stock</div>
                      <div className="text-2xl font-black text-primary">
                        {crossStockResult.totalStockAcrossAllBranches}{" "}
                        <span className="text-xs font-normal text-text-secondary">units</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {crossStockResult.branches.map((b) => (
                      <Card key={b.branchId} className="bg-surface border-border">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-semibold text-text-primary text-sm">{b.branchName}</h5>
                              <p className="text-[11px] text-text-secondary">{b.branchAddress || "No address"}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                b.stockQty > 0
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold"
                                  : "bg-surface-2 text-text-secondary"
                              }
                            >
                              {b.stockQty} In Stock
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border">
                            <div>
                              <span className="text-text-secondary block text-[10px]">Effective Price:</span>
                              <span className="font-semibold text-text-primary">
                                ${b.effectiveSalePrice.toFixed(2)}
                              </span>
                              {b.hasPriceOverride && (
                                <span className="block text-[10px] text-primary">(Custom Override)</span>
                              )}
                            </div>
                            <div>
                              <span className="text-text-secondary block text-[10px]">Last Movement:</span>
                              <span className="text-text-primary text-[11px]">
                                {b.lastUpdated ? new Date(b.lastUpdated).toLocaleDateString() : "No movement"}
                              </span>
                            </div>
                          </div>

                          {/* Batches breakdown */}
                          {b.batches.length > 0 && (
                            <div>
                              <button
                                type="button"
                                className="flex items-center justify-between w-full text-[11px] font-medium text-text-secondary hover:text-text-primary"
                                onClick={() =>
                                  setExpandedBranchBatchId(
                                    expandedBranchBatchId === b.branchId ? null : b.branchId,
                                  )
                                }
                              >
                                <span>{b.batches.length} Active Batch(es)</span>
                                {expandedBranchBatchId === b.branchId ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>

                              {expandedBranchBatchId === b.branchId && (
                                <div className="mt-2 space-y-1.5 p-2 bg-surface-2 rounded-lg text-[11px]">
                                  {b.batches.map((batch) => (
                                    <div key={batch.id} className="flex justify-between items-center">
                                      <span className="font-mono text-text-primary">{batch.batchNumber}</span>
                                      <span className="text-text-secondary">
                                        Exp: {new Date(batch.expiryDate).toLocaleDateString()}
                                      </span>
                                      <span className="font-semibold text-text-primary">{batch.quantity}u</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {b.stockQty > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs h-7 mt-2"
                              onClick={() => {
                                setTransferSourceBranchId(b.branchId);
                                if (user?.branchId && user.branchId !== b.branchId) {
                                  setTransferDestBranchId(user.branchId);
                                } else {
                                  const dest = branches.find((br) => br.id !== b.branchId);
                                  if (dest) setTransferDestBranchId(dest.id);
                                }
                                if (b.productId) setTransferProductId(b.productId);
                                setActiveTab("transfers");
                                setIsNewTransferOpen(true);
                              }}
                            >
                              Request Transfer From Here
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* =================================================================== */}
      {/* MODAL: ADD / EDIT BRANCH                                            */}
      {/* =================================================================== */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditingId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBranchSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="branch-name" className="text-xs">Branch Name</Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Downtown Central Branch"
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
                placeholder="e.g. 101 Medical Plaza"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-phone" className="text-xs">Phone</Label>
              <Input
                id="branch-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +966 11 000 0000"
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="branch-active"
                  checked={isActive}
                  onCheckedChange={(v) => setIsActive(!!v)}
                />
                <Label htmlFor="branch-active" className="text-xs">Branch is active and open for transactions</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="branch-price-override"
                  checked={allowPriceOverride}
                  onCheckedChange={(v) => setAllowPriceOverride(!!v)}
                />
                <Label htmlFor="branch-price-override" className="text-xs">
                  Allow branch price overrides (Custom retail prices)
                </Label>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-primary text-white"
              disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Create Branch"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL: BRANCH PRICE OVERRIDES                                       */}
      {/* =================================================================== */}
      <Dialog
        open={!!priceOverrideBranch}
        onOpenChange={(v) => { if (!v) setPriceOverrideBranch(null); }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Price Overrides: {priceOverrideBranch?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <form onSubmit={handleAddPriceOverride} className="p-4 bg-surface-2 rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Set New Price Override</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Select Product</Label>
                  <Select value={newOverrideProductId} onValueChange={setNewOverrideProductId}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Choose medicine..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (${p.salePrice.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Branch Override Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 19.99"
                    value={newOverridePrice}
                    onChange={(e) => setNewOverridePrice(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Reason / Justification</Label>
                  <Input
                    placeholder="e.g. High rent area"
                    value={newOverrideReason}
                    onChange={(e) => setNewOverrideReason(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full bg-primary text-white text-xs h-8"
                disabled={!newOverrideProductId || !newOverridePrice || setOverrideMutation.isPending}
              >
                {setOverrideMutation.isPending ? "Saving Override..." : "Save Branch Price Override"}
              </Button>
            </form>

            {/* Overrides Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Active Overrides</h4>
              {currentOverrides.length === 0 ? (
                <div className="py-6 text-center text-xs text-text-secondary">
                  No price overrides configured for this branch. Central catalog prices apply.
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-2 text-text-secondary border-b border-border">
                      <tr>
                        <th className="p-2.5">Medicine</th>
                        <th className="p-2.5">Catalog Price</th>
                        <th className="p-2.5">Branch Price</th>
                        <th className="p-2.5">Reason</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {currentOverrides.map((o) => (
                        <tr key={o.id} className="hover:bg-surface-2/50">
                          <td className="p-2.5 font-medium text-text-primary">{o.productName}</td>
                          <td className="p-2.5 text-text-secondary">${o.catalogPrice.toFixed(2)}</td>
                          <td className="p-2.5 font-bold text-primary">${o.overridePrice.toFixed(2)}</td>
                          <td className="p-2.5 text-text-secondary">{o.reason || "—"}</td>
                          <td className="p-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-text-secondary hover:text-danger"
                              onClick={() => {
                                if (priceOverrideBranch) {
                                  deleteOverrideMutation.mutate({
                                    branchId: priceOverrideBranch.id,
                                    productId: o.productId,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL: NEW STOCK TRANSFER                                           */}
      {/* =================================================================== */}
      <Dialog open={isNewTransferOpen} onOpenChange={setIsNewTransferOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              New Inter-Branch Stock Transfer
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTransfer} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Source Branch (From)</Label>
                <Select value={transferSourceBranchId} onValueChange={setTransferSourceBranchId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select source branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Destination Branch (To)</Label>
                <Select value={transferDestBranchId} onValueChange={setTransferDestBranchId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select destination branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id} disabled={b.id === transferSourceBranchId}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Medicine to Transfer</Label>
              <Select value={transferProductId} onValueChange={setTransferProductId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Choose medicine to transfer..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.barcode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Quantity to Transfer</Label>
              <Input
                type="number"
                min="1"
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(parseInt(e.target.value, 10) || 1)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Dispatch Memo</Label>
              <Textarea
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="Reason for transfer, driver details, or instructions..."
                className="text-xs h-20"
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg">
              <Checkbox
                id="send-immediately"
                checked={transferSendImmediately}
                onCheckedChange={(v) => setTransferSendImmediately(!!v)}
              />
              <Label htmlFor="send-immediately" className="text-xs cursor-pointer">
                <span className="font-semibold block text-text-primary">Dispatch Immediately (In-Transit)</span>
                <span className="text-text-secondary text-[11px]">
                  Source branch inventory will be deducted right now and prepared for transit.
                </span>
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-white"
              disabled={createTransferMutation.isPending}
            >
              {createTransferMutation.isPending ? "Processing..." : "Create Transfer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL: TRANSFER DETAIL & BATCH TRAVEL VERIFICATION                  */}
      {/* =================================================================== */}
      <Dialog
        open={!!selectedTransferForDetail}
        onOpenChange={(v) => { if (!v) setSelectedTransferForDetail(null); }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Transfer: {selectedTransferForDetail?.transferNumber}</span>
              <Badge variant="outline" className="text-xs">
                {selectedTransferForDetail?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedTransferForDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-2 rounded-lg text-xs">
                <div>
                  <span className="text-text-secondary block">Source Branch:</span>
                  <span className="font-semibold text-text-primary">{selectedTransferForDetail.sourceBranch?.name}</span>
                </div>
                <div>
                  <span className="text-text-secondary block">Destination Branch:</span>
                  <span className="font-semibold text-text-primary">{selectedTransferForDetail.destinationBranch?.name}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-text-secondary mb-2">Transferred Items (Batch Travel Data)</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-2 text-text-secondary border-b border-border">
                      <tr>
                        <th className="p-2.5">Medicine</th>
                        <th className="p-2.5">Batch #</th>
                        <th className="p-2.5">Expiry Date</th>
                        <th className="p-2.5">Qty</th>
                        <th className="p-2.5">Cost/Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedTransferForDetail.items.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-2/50">
                          <td className="p-2.5 font-medium text-text-primary">{item.productName}</td>
                          <td className="p-2.5 font-mono text-primary">{item.batchNumber}</td>
                          <td className="p-2.5 text-text-secondary">
                            {new Date(item.expiryDate).toLocaleDateString()}
                          </td>
                          <td className="p-2.5 font-bold text-text-primary">{item.quantity}</td>
                          <td className="p-2.5 text-text-secondary">${item.unitCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedTransferForDetail.notes && (
                <div className="text-xs text-text-secondary bg-surface-2 p-3 rounded-lg">
                  <span className="font-semibold text-text-primary block">Transfer Notes:</span>
                  {selectedTransferForDetail.notes}
                </div>
              )}

              <DialogFooter className="gap-2">
                {selectedTransferForDetail.status === "PENDING" && (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    onClick={() => sendTransferMutation.mutate(selectedTransferForDetail.id)}
                  >
                    Approve & Dispatch
                  </Button>
                )}
                {selectedTransferForDetail.status === "IN_TRANSIT" && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    onClick={() => receiveTransferMutation.mutate(selectedTransferForDetail.id)}
                  >
                    Receive Stock into Destination Branch
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL: REJECT REASON                                                */}
      {/* =================================================================== */}
      <Dialog
        open={!!rejectDialogTransferId}
        onOpenChange={(v) => { if (!v) setRejectDialogTransferId(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              Rejecting this transfer will automatically return all deducted stock and batches back to the source branch.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for rejection</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Package damaged in transit, incorrect cold-chain handling..."
                className="text-xs h-24"
                required
              />
            </div>
            <Button
              variant="destructive"
              className="w-full text-xs"
              onClick={() => {
                if (rejectDialogTransferId && rejectReason.trim()) {
                  rejectTransferMutation.mutate({
                    id: rejectDialogTransferId,
                    reason: rejectReason.trim(),
                  });
                }
              }}
              disabled={!rejectReason.trim() || rejectTransferMutation.isPending}
            >
              {rejectTransferMutation.isPending ? "Processing Reversal..." : "Confirm Rejection & Revert Stock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Confirm */}
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