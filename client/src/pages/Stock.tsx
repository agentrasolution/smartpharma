import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RotateCcw, Eye, EyeOff, Barcode, Search } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { StockPurchase, Product, Company, Distributor } from "@/types";

export default function Stock() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showValue, setShowValue] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [scanValue, setScanValue] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    productId: "", distributorId: "", companyId: "",
    invoiceNumber: "", packs: "1", quantity: "", expiry: "",
  });
  const [qtyLocked, setQtyLocked] = useState(true);

  const { data: stockEntries = [], isLoading } = useQuery({ queryKey: ["stock"], queryFn: api.stock.list });
  const filtered = showArchived ? stockEntries : stockEntries.filter((s: StockPurchase) => s.active !== 0);
  const searched = filtered.filter((s: StockPurchase) =>
    !search
    || (s.product_name && s.product_name.toLowerCase().includes(search.toLowerCase()))
    || (s.company_name && s.company_name.toLowerCase().includes(search.toLowerCase()))
    || (s.distributor_name && s.distributor_name.toLowerCase().includes(search.toLowerCase()))
    || (s.invoice_number && s.invoice_number.toLowerCase().includes(search.toLowerCase()))
  );
  const { data: productList = { data: [] as Product[] } } = useQuery({ queryKey: ["products"], queryFn: () => api.products.list({ pageSize: 1000 }) });
  const products = productList.data;
  const { data: distributors = [] } = useQuery({ queryKey: ["distributors"], queryFn: api.distributors.list });
  const { data: companies = [] } = useQuery({ queryKey: ["companies"], queryFn: api.companies.list });

  const selectedProduct = products.find((p: Product) => p.id === form.productId) as Product | undefined;
  const packSize = selectedProduct?.pack_size ?? 1;

  function handlePacksChange(packs: string) {
    const p = Number(packs) || 0;
    setForm((prev) => ({ ...prev, packs, quantity: qtyLocked && p > 0 ? String(p * packSize) : prev.quantity }));
  }

  function handleQuantityChange(qty: string) {
    const q = Number(qty) || 0;
    setForm({ ...form, quantity: qty, packs: q > 0 ? String(Math.round(q / packSize) || 1) : "1" });
  }

  const totalValue = searched.reduce((s: number, i: StockPurchase) => s + i.total_value, 0);

  const createMutation = useMutation({
    mutationFn: () => api.stock.create({
      productId: form.productId,
      distributorId: form.distributorId || undefined,
      companyId: form.companyId || undefined,
      invoiceNumber: form.invoiceNumber,
      quantity: Number(form.quantity),
      expiry: form.expiry || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setForm({ productId: "", distributorId: "", companyId: "", invoiceNumber: "", packs: "1", quantity: "", expiry: "" });
      toast.success("Stock purchase recorded");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.stock.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock entry deleted");
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.stock.update(editingId!, {
      productId: form.productId,
      distributorId: form.distributorId || undefined,
      companyId: form.companyId || undefined,
      invoiceNumber: form.invoiceNumber,
      quantity: Number(form.quantity),
      expiry: form.expiry || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setEditingId(null);
      setForm({ productId: "", distributorId: "", companyId: "", invoiceNumber: "", packs: "1", quantity: "", expiry: "" });
      toast.success("Stock purchase updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (open && scanRef.current) {
      setTimeout(() => scanRef.current?.focus(), 100);
    }
  }, [open]);

  async function handleScan(value: string) {
    const product = await api.products.getByBarcode(value.trim());
    if (product) {
      setForm((prev) => ({ ...prev, productId: product.id }));
      toast.success(`Found: ${product.name}`);
    } else {
      toast.error("No product found with this barcode");
    }
    setScanValue("");
    scanRef.current?.focus();
  }

  function openAdd() {
    setEditingId(null);
    setForm({ productId: "", distributorId: "", companyId: "", invoiceNumber: "", packs: "1", quantity: "", expiry: "" });
    setQtyLocked(true);
    setScanValue("");
    setOpen(true);
  }

  function openEdit(entry: StockPurchase) {
    const qty = entry.quantity;
    const p = products.find((p: Product) => p.id === entry.product_id);
    const ps = p?.pack_size ?? 1;
    setEditingId(entry.id);
    setForm({
      productId: entry.product_id,
      distributorId: entry.distributor_id || "",
      companyId: entry.company_id || "",
      invoiceNumber: entry.invoice_number || "",
      packs: String(Math.round(qty / ps) || 1),
      quantity: String(qty),
      expiry: entry.expiry || "",
    });
    setQtyLocked(true);
    setOpen(true);
  }

  const columns = [
    { key: "created_at", header: "Date", cell: (s: StockPurchase) => <span className="font-mono text-[11px] text-text-secondary">{formatDate(s.created_at)}</span> },
    { key: "product_name", header: "Product", cell: (s: StockPurchase) => <span className="text-xs font-medium text-text-primary">{s.product_name}</span> },
    { key: "company_name", header: "Company", cell: (s: StockPurchase) => <span className="text-[11px] text-text-secondary">{s.company_name || "\u2014"}</span> },
    { key: "distributor_name", header: "Distributor", cell: (s: StockPurchase) => <span className="text-[11px] text-text-secondary">{s.distributor_name || "\u2014"}</span> },
    { key: "invoice_number", header: "Invoice", cell: (s: StockPurchase) => <span className="font-mono text-[11px] text-text-secondary">{s.invoice_number || "\u2014"}</span> },
    { key: "quantity", header: "Qty", cell: (s: StockPurchase) => <span className="font-mono text-xs font-semibold">{s.quantity}</span> },
    { key: "purchase_price", header: "Cost", cell: (s: StockPurchase) => <span className="font-mono text-xs">{formatCurrency(s.purchase_price)}</span> },
    { key: "sale_price", header: "Sale Price", cell: (s: StockPurchase) => <span className="font-mono text-xs text-accent font-semibold">{formatCurrency(s.sale_price)}</span> },
    { key: "total_value", header: "Total", cell: (s: StockPurchase) => <span className="font-mono text-xs font-bold text-text-primary">{formatCurrency(s.total_value)}</span> },
    { key: "expiry", header: "Expiry", cell: (s: StockPurchase) => <span className="font-mono text-[11px] text-text-secondary">{s.expiry ? formatDate(s.expiry) : "\u2014"}</span> },
    {
      key: "actions", header: "", cell: (s: StockPurchase) => (
        <div className="flex items-center gap-0.5 justify-end">
          {s.active !== 0 ? (
            <>
              <button onClick={() => openEdit(s)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteId(s.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Stock / Purchases" description="Track inventory purchases and stock levels" action={{ label: "New Purchase", onClick: openAdd }} />
      
      <div className="mb-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Total Stock Value</p>
                <p className="text-xl font-bold text-text-primary tabular-nums">
                  {showValue ? formatCurrency(totalValue) : "••••••••"}
                </p>
              </div>
              <button onClick={() => setShowValue(!showValue)} className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent hover:bg-accent/20 transition-colors" title={showValue ? "Hide value" : "Show value"}>
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input autoFocus placeholder="Search by product, company, distributor, invoice..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`text-xs flex items-center gap-1 px-2.5 h-7 rounded-md transition-colors ${showArchived ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-surface-2"}`}
        >
          <RotateCcw className="h-3 w-3" />
          Show archived
        </button>
      </div>
      <div className="rounded-lg border border-border">
        <DataTable columns={columns} data={searched} loading={isLoading} keyExtractor={(s: StockPurchase) => s.id} />
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingId(null); } setOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Stock Purchase" : "Record Stock Purchase"}</DialogTitle></DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
              <Input
                ref={scanRef}
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && scanValue.trim()) {
                    handleScan(scanValue.trim());
                  }
                }}
                placeholder="Scan barcode or QR code to select product..."
                className="pl-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label>Product</Label>
                <SearchableSelect
                  options={products.map((p: Product) => ({ value: p.id, label: `${p.name} — ${p.category || "No Category"}` }))}
                  value={form.productId}
                  onChange={(v) => setForm({ ...form, productId: v })}
                  placeholder="Select product"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Company</Label>
                <SearchableSelect
                  options={companies.map((c: Company) => ({ value: c.id, label: c.name }))}
                  value={form.companyId}
                  onChange={(v) => setForm({ ...form, companyId: v })}
                  placeholder="Select company"
                />
              </div>
              <div className="space-y-1">
                <Label>Distributor</Label>
                <SearchableSelect
                  options={distributors.map((d: Distributor) => ({ value: d.id, label: d.name }))}
                  value={form.distributorId}
                  onChange={(v) => setForm({ ...form, distributorId: v })}
                  placeholder="Select distributor"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Invoice Number</Label>
              <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="e.g. INV-001" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Packs {packSize > 1 ? <span className="text-text-secondary font-normal">({packSize}/pack)</span> : null}</Label>
                <Input type="number" min="1" value={form.packs} onChange={(e) => handlePacksChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Total Quantity</Label>
                <div onDoubleClick={() => setQtyLocked(false)}>
                  <Input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    readOnly={qtyLocked}
                    className={qtyLocked ? "opacity-60 cursor-default select-none" : ""}
                    tabIndex={qtyLocked ? -1 : 0}
                    title={qtyLocked ? "Double Click to Edit" : undefined}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Expiry (optional)</Label>
              <Input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} min={new Date().toISOString().split("T")[0]} />
            </div>
            <Button className="w-full" disabled={!form.productId || !form.quantity || createMutation.isPending || updateMutation.isPending}
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update Purchase" : "Record Purchase"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Delete Stock Entry"
        description="This will remove the stock quantity from the product. The entry will be archived and can be viewed later."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
