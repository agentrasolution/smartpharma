import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw, Send, Bot, Search } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types";

const statusMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "outline" | "danger" }> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PENDING_APPROVAL: { label: "Pending Approval", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

export default function AIApprovals() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("PENDING_APPROVAL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PurchaseOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const role = user?.role ?? "";
  const canApprove = role === "admin" || role === "manager";
  const canSubmit = role === "admin" || role === "manager" || role === "pharmacist";

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-purchase-orders", filter, search, from, to],
    queryFn: () =>
      api.purchaseOrders.list({
        status: filter === "ALL" ? undefined : (filter as PurchaseOrderStatus),
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ["ai-purchase-orders", "ALL", "", "", ""],
    queryFn: () => api.purchaseOrders.list(undefined),
    staleTime: 15000,
  });

  const pendingCount = allOrders.filter((o) => o.status === "PENDING_APPROVAL").length;
  const draftCount = allOrders.filter((o) => o.status === "DRAFT").length;

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.purchaseOrders.submit(id),
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} submitted for approval`);
      queryClient.invalidateQueries({ queryKey: ["ai-purchase-orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.purchaseOrders.approve(id),
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} approved; stock received`);
      queryClient.invalidateQueries({ queryKey: ["ai-purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.purchaseOrders.reject(id, reason),
    onSuccess: () => {
      toast.success("Purchase order rejected");
      queryClient.invalidateQueries({ queryKey: ["ai-purchase-orders"] });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const anyBusy = submitMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  const columns = [
    { key: "orderNumber", header: "Order No.", cell: (o: PurchaseOrder) => (
      <span className="font-mono font-medium text-text-primary">{o.orderNumber}</span>
    ) },
    { key: "distributor", header: "Distributor", cell: (o: PurchaseOrder) => (
      <span className="text-text-primary">{o.distributor?.name ?? "—"}</span>
    ) },
    { key: "source", header: "Source", cell: (o: PurchaseOrder) => (
      o.aiGenerated
        ? <Badge variant="default"><Bot className="h-3 w-3" /> AI</Badge>
        : <Badge variant="outline">HUMAN</Badge>
    ), className: "text-center" },
    { key: "items", header: "Items", cell: (o: PurchaseOrder) => (
      <span className="font-mono text-text-secondary">{o.items.length}</span>
    ) },
    { key: "total", header: "Total", cell: (o: PurchaseOrder) => (
      <span className="font-mono font-semibold">{formatCurrency(o.total)}</span>
    ) },
    { key: "date", header: "Created", cell: (o: PurchaseOrder) => (
      <span className="font-mono text-xs text-text-secondary">{formatDateTime(o.createdAt)}</span>
    ) },
    { key: "status", header: "Status", cell: (o: PurchaseOrder) => {
      const cfg = statusMap[o.status] ?? { label: o.status, variant: "outline" as const };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    }, className: "text-center" },
    { key: "expand", header: "", cell: (o: PurchaseOrder) => (
      <span className="flex items-center justify-center text-text-secondary">
        {expanded === o.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </span>
    ), className: "text-center" },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Order Approvals"
        description="Human-only approval of AI-generated purchase order drafts (the AI creates all orders)"
        action={{ label: "Refresh", onClick: () => refetch() }}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput.trim()); }}
            placeholder="Search order number or distributor..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <label className="text-[11px] text-text-secondary">From</label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
        <label className="text-[11px] text-text-secondary">To</label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px] text-xs" />
        {(search || from || to) && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setSearch(""); setSearchInput(""); setFrom(""); setTo(""); }}>
            Clear
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="mb-4">
          <TabsTrigger value="PENDING_APPROVAL">Pending Approval {pendingCount > 0 && `(${pendingCount})`}</TabsTrigger>
          <TabsTrigger value="DRAFT">Drafts {draftCount > 0 && `(${draftCount})`}</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl border border-border overflow-hidden">
        <DataTable
          columns={columns}
          data={orders}
          loading={isLoading}
          keyExtractor={(o: PurchaseOrder) => o.id}
          onRowClick={(o: PurchaseOrder) => setExpanded(expanded === o.id ? null : o.id)}
          emptyMessage="No purchase orders in this state"
        />
      </div>

      <OrderDetail
        orderId={expanded}
        anyBusy={anyBusy}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(order) => { setRejectTarget(order); setRejectReason(""); }}
        onSubmit={(id) => submitMutation.mutate(id)}
        canApprove={canApprove}
        canSubmit={canSubmit}
      />

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
            <DialogDescription>Provide a reason for rejecting {rejectTarget?.orderNumber}.</DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              className="w-full min-h-[80px] rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button variant="destructive" disabled={!rejectReason.trim() || rejectMutation.isPending} onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })}>
                Reject Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDetail({ orderId, anyBusy, onApprove, onReject, onSubmit, canApprove, canSubmit }:
  {
    orderId: string | null;
    anyBusy: boolean;
    onApprove: (id: string) => void;
    onReject: (order: PurchaseOrder) => void;
    onSubmit: (id: string) => void;
    canApprove: boolean;
    canSubmit: boolean;
  }) {
  const { data: order, isLoading } = useQuery({
    queryKey: ["ai-purchase-order", orderId],
    queryFn: () => (orderId ? api.purchaseOrders.getById(orderId) : Promise.resolve(null)),
    enabled: !!orderId,
  });
  if (!orderId || isLoading || !order) return null;
  return (
    <div className="mt-3 rounded-xl border border-border overflow-hidden bg-bg-secondary/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div>
          <span className="text-sm font-medium text-text-primary">{order.orderNumber}</span>
          <span className="ml-2 text-xs text-text-secondary">{order.distributor?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {order.aiGenerated && <Badge variant="default"><Bot className="h-3 w-3" /> AI-generated draft</Badge>}
          <span className="text-xs text-text-secondary">{order.items.length} line item(s)</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left px-4 py-2 text-xs font-medium text-text-secondary">Product</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary">Qty</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary">Unit Price</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-border/40">
                <td className="px-4 py-2 text-xs text-text-primary">{item.product.name}</td>
                <td className="px-4 py-2 text-right font-mono text-xs">{item.quantity}</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-text-secondary">{formatCurrency(item.unitPrice)}</td>
                <td className="px-4 py-2 text-right font-mono text-xs">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right text-xs font-semibold text-text-primary">Order Total</td>
              <td className="px-4 py-2 text-right font-mono text-sm font-bold">{formatCurrency(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {order.notes && (
        <div className="px-4 py-2 border-b border-border/40 text-xs text-text-secondary">
          <span>Notes: </span><span className="text-text-primary">{order.notes}</span>
        </div>
      )}

      {order.status === "DRAFT" && canSubmit && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border/60 justify-end">
          <Button size="sm" className="h-8" disabled={anyBusy} onClick={() => onSubmit(order.id)}>
            <Send className="h-3.5 w-3.5" /> Submit for Approval
          </Button>
        </div>
      )}
      {order.status === "PENDING_APPROVAL" && canApprove && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border/60 justify-end">
          <Button size="sm" variant="outline" className="h-8" disabled={anyBusy} onClick={() => onReject(order)}>
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
          <Button size="sm" className="h-8" disabled={anyBusy} onClick={() => onApprove(order.id)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Receive Stock
          </Button>
        </div>
      )}
      {order.status === "REJECTED" && order.rejectionReason && (
        <div className="px-4 py-3 border-t border-border/60 text-xs">
          <span className="text-text-secondary">Rejection reason: </span>
          <span className="text-danger">{order.rejectionReason}</span>
          {order.rejectedAt && (
            <span className="ml-2 text-text-secondary">· {formatDateTime(order.rejectedAt)}</span>
          )}
        </div>
      )}
      {order.status === "APPROVED" && order.approvedAt && (
        <div className="px-4 py-3 border-t border-border/60 text-xs">
          <span className="text-text-secondary">Approved &amp; stock received </span>
          <span className="text-success">· {formatDateTime(order.approvedAt)}</span>
        </div>
      )}
    </div>
  );
}