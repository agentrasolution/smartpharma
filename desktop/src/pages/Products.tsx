import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Archive, RotateCcw, Pencil, Download, Upload, Trash2, Tags, Barcode } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, generateBarcode } from "@/lib/utils";
import { api } from "@/lib/api";
import { downloadCSV, downloadPDF } from "@/lib/export";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import PrintBarcodeDialog from "@/components/shared/PrintBarcodeDialog";
import type { Product, ProductPriceInput, Category } from "@/types";

interface CsvRow {
  rowNum: number; barcode: string; name: string; category: string; location: string;
  purchasePrice: string; salePrice: string; expiry: string; company: string; packSize: string; error?: string;
}

interface ImportRowResult {
  rowNum: number; barcode: string; name: string; status: "pending" | "completed" | "rejected"; message?: string;
}

const HEADER_LOOKUP: Record<string, string> = {
  "barcode": "barcode", "bar code": "barcode", "code": "barcode", "baar code": "barcode", "baarcode": "barcode",
  "product code": "barcode", "item code": "barcode", "sku": "barcode", "upc": "barcode", "ean": "barcode",
  "name": "name", "product name": "name", "medicine": "name", "medicine name": "name", "item": "name", "item name": "name",
  "product": "name", "description": "name", "drug name": "name", "medication": "name",
  "purchased price": "purchasePrice", "purchasedprice": "purchasePrice", "purchase price": "purchasePrice",
  "purchaseprice": "purchasePrice", "price": "purchasePrice", "purchase": "purchasePrice",
  "cost price": "purchasePrice", "cost": "purchasePrice", "buying price": "purchasePrice", "buy price": "purchasePrice",
  "sale price": "salePrice", "saleprice": "salePrice", "selling price": "salePrice", "retail price": "salePrice", "retail": "salePrice",
  "sales price": "salePrice", "sell price": "salePrice", "unit price": "salePrice", "mrp": "salePrice", "price retail": "salePrice",
  "category": "category", "categories": "category", "cat": "category", "section": "category", "type": "category", "class": "category",
  "location": "location", "loc": "location", "shelf": "location", "rack": "location", "position": "location", "storage": "location",
  "expiry date": "expiry", "expiry time": "expiry", "expiry": "expiry", "exp": "expiry", "expiration": "expiry", "exp date": "expiry", "use by": "expiry",
  "company": "company", "manufacturer": "company", "brand": "company", "company name": "company", "vendor": "company", "supplier": "company",
  "pack size": "packSize", "packsize": "packSize", "units per pack": "packSize", "quantity per pack": "packSize", "pack qty": "packSize",
  "tablets per pack": "packSize", "pack": "packSize", "per pack": "packSize",
};

interface PriceTierForm {
  purchasePrice: string; salePrice: string;
}

interface ProductForm {
  barcode: string; name: string; category: string; location: string;
  purchasePrice: string; salePrice: string; packSize: string;
  prices: PriceTierForm[];
}

const emptyPriceTier = (): PriceTierForm => ({
  purchasePrice: "", salePrice: "",
});

const emptyForm = (): ProductForm => ({
  barcode: generateBarcode(), name: "", category: "", location: "",
  purchasePrice: "", salePrice: "", packSize: "1",
  prices: [],
});

export default function Products() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [lastAddedProduct, setLastAddedProduct] = useState<{ barcode: string; name: string; price: number } | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [barcodeExists, setBarcodeExists] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<CsvRow[]>([]);
  const [importImporting, setImportImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResults, setImportResults] = useState<ImportRowResult[]>([]);
  const [importResultsOpen, setImportResultsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [catDeleteId, setCatDeleteId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [printBarcode, setPrintBarcode] = useState<{ barcode?: string } | null>(null);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["products", showArchived, page, debouncedSearch],
    queryFn: () =>
      api.products.list({
        page,
        pageSize: 50,
        search: debouncedSearch || undefined,
        includeArchived: showArchived,
      }),
  });
  const products = pageData?.data ?? [];
  const total = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
  });

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (open && barcodeInputRef.current) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  async function checkBarcode(barcode: string) {
    if (!barcode.trim()) { setBarcodeExists(null); return; }
    try {
      const existing = await api.products.getByBarcode(barcode.trim());
      if (existing && existing.id !== editingId) {
        setBarcodeExists(`Barcode already in use by "${existing.name}"`);
      } else {
        setBarcodeExists(null);
      }
    } catch {
      setBarcodeExists(null);
    }
  }

  function buildPricesPayload(): ProductPriceInput[] | undefined {
    const validPrices = form.prices.filter((p) => p.purchasePrice);
    if (validPrices.length === 0) return undefined;
    return validPrices.map((p) => ({
      purchasePrice: Number(p.purchasePrice),
      salePrice: Number(p.salePrice) || 0,
    }));
  }

  const createMutation = useMutation({
    mutationFn: () => api.products.create({
      barcode: form.barcode, name: form.name, category: form.category,
      location: form.location, purchasePrice: Number(form.purchasePrice),
      salePrice: Number(form.salePrice) || 0, packSize: Number(form.packSize),
      prices: buildPricesPayload(),
    }),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setAddedId(product.id);
      setLastAddedProduct({ barcode: product.barcode, name: product.name, price: product.sale_price });
      setOpen(false);
      toast.success("Product created");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.products.update(editingId!, {
      barcode: form.barcode, name: form.name, category: form.category,
      location: form.location, purchasePrice: Number(form.purchasePrice),
      salePrice: Number(form.salePrice) || 0, packSize: Number(form.packSize),
      prices: buildPricesPayload(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setEditingId(null);
      toast.success("Product updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.products.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product archived");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.products.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product restored");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const catCreateMutation = useMutation({
    mutationFn: () => api.categories.create({ name: catName }),
    onSuccess: () => {
      toast.success("Category created");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCatName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const catUpdateMutation = useMutation({
    mutationFn: () => api.categories.update(catEditingId!, { name: catName }),
    onSuccess: () => {
      toast.success("Category updated");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCatOpen(false);
      setCatEditingId(null);
      setCatName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const catDeleteMutation = useMutation({
    mutationFn: (id: string) => api.categories.delete(id),
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCatDeleteId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setCatDeleteId(null);
    },
  });

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setBarcodeExists(null);
    setOpen(true);
  }

  function openEdit(product: Product) {
    setEditingId(product.id);
    const p = (product as any).prices as { purchasePrice: number; salePrice: number }[] | undefined;
    setForm({
      barcode: product.barcode, name: product.name, category: product.category,
      location: product.location, purchasePrice: String(product.purchase_price),
      salePrice: String(product.sale_price), packSize: String(product.pack_size),
      prices: p
        ? p.map((pt) => ({ purchasePrice: String(pt.purchasePrice), salePrice: String(pt.salePrice) }))
        : [],
    });
    setBarcodeExists(null);
    setOpen(true);
  }

  function addPriceTier() {
    setForm((prev) => ({ ...prev, prices: [...prev.prices, emptyPriceTier()] }));
  }

  function removePriceTier(index: number) {
    setForm((prev) => ({ ...prev, prices: prev.prices.filter((_, i) => i !== index) }));
  }

  function updatePriceTier(index: number, field: keyof PriceTierForm, value: string) {
    setForm((prev) => ({
      ...prev,
      prices: prev.prices.map((pt, i) => (i === index ? { ...pt, [field]: value } : pt)),
    }));
  }

  function normalizeHeader(h: string) {
    return h.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/\s+/g, " ");
  }

  function matchHeader(header: string): string | null {
    return HEADER_LOOKUP[normalizeHeader(header)] || null;
  }

  function parseCsvContent(text: string): { errors: string[]; rows: CsvRow[] } {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return { errors: ["CSV must have a header row and at least one data row"], rows: [] };

    const rawHeaders = parseCsvLine(lines[0]);
    const headerMap = new Map<number, string>();
    const unmatchedHeaders: string[] = [];

    for (let i = 0; i < rawHeaders.length; i++) {
      const matched = matchHeader(rawHeaders[i]);
      if (matched) {
        headerMap.set(i, matched);
      } else {
        unmatchedHeaders.push(normalizeHeader(rawHeaders[i]));
      }
    }

    if (!hasHeader(headerMap, "barcode")) return { errors: ["Missing required column: barcode (or bar code, code)"], rows: [] };
    if (!hasHeader(headerMap, "name")) return { errors: ["Missing required column: name (or product name, medicine, item)"], rows: [] };
    if (!hasHeader(headerMap, "purchasePrice")) return { errors: ["Missing required column: purchase price (or price, purchase)"], rows: [] };

    const errors: string[] = [];
    if (unmatchedHeaders.length > 0) {
      errors.push(`Unrecognized columns ignored: ${unmatchedHeaders.join(", ")}`);
    }

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const row: CsvRow = {
        rowNum: i + 1,
        barcode: cols[findIndex(headerMap, "barcode")]?.trim() || "",
        name: cols[findIndex(headerMap, "name")]?.trim() || "",
        purchasePrice: cols[findIndex(headerMap, "purchasePrice")]?.trim() || "",
        salePrice: hasHeader(headerMap, "salePrice") ? cols[findIndex(headerMap, "salePrice")]?.trim() || "" : "",
        category: hasHeader(headerMap, "category") ? cols[findIndex(headerMap, "category")]?.trim() || "" : "",
        location: hasHeader(headerMap, "location") ? cols[findIndex(headerMap, "location")]?.trim() || "" : "",
        expiry: hasHeader(headerMap, "expiry") ? cols[findIndex(headerMap, "expiry")]?.trim() || "" : "",
        company: hasHeader(headerMap, "company") ? cols[findIndex(headerMap, "company")]?.trim() || "" : "",
        packSize: hasHeader(headerMap, "packSize") ? cols[findIndex(headerMap, "packSize")]?.trim() || "" : "",
      };
      const rowErrors: string[] = [];
      if (!row.barcode) rowErrors.push("Missing barcode");
      if (!row.name) rowErrors.push("Missing name");
      if (!row.purchasePrice) rowErrors.push("Missing purchase price");
      else if (isNaN(Number(row.purchasePrice)) || Number(row.purchasePrice) < 0) rowErrors.push("Invalid purchase price");
      if (rowErrors.length > 0) row.error = rowErrors.join("; ");
      rows.push(row);
    }
    return { errors, rows };
  }

  function findIndex(map: Map<number, string>, key: string): number {
    for (const [idx, val] of map) {
      if (val === key) return idx;
    }
    return -1;
  }

  function hasHeader(map: Map<number, string>, key: string): boolean {
    return findIndex(map, key) !== -1;
  }

  function processContent(_name: string, text: string) {
    const stripped = text.replace(/^\uFEFF/, "");
    const result = parseCsvContent(stripped);
    if (result.errors.length > 0 && result.rows.length === 0) {
      toast.error(result.errors.join(". "));
      return;
    }
    setImportRows(result.rows);
    setImportOpen(true);
  }

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => processContent(file.name, (ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  async function handlePickCsv() {
    try {
      const picker = (window as any).electronAPI?.files?.pickCsv;
      if (picker) {
        const res = await picker();
        if (res?.content) processContent(res.name, res.content);
        return;
      }
    } catch {
      // fall back to the browser file input below
    }
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please drop a .csv file");
      return;
    }
    processFile(file);
  }

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ",") { result.push(current); current = ""; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result;
  }

  function downloadSampleCsv() {
    const sample = `Barcode,Product Name,Purchase Price,Sale Price,Category,Location,Expiry,Company,Pack Size
123456,Panadol 500mg,80,100,Tablets,Shelf A1,2027-12-31,GSK,10
123457,Brufen 400mg,120,150,Capsules,Shelf B2,2028-06-15,Abbott,20
123458,Augmentin 1g,250,300,Tablets,Shelf A3,2027-09-01,GSK,14`;
    const blob = new Blob(["\uFEFF" + sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    setImportImporting(true);
    setImportProgress({ done: 0, total: importRows.length });
    const results: ImportRowResult[] = importRows.map((row) => ({
      rowNum: row.rowNum, barcode: row.barcode, name: row.name,
      status: "pending" as const,
    }));
    setImportResults(results);
    setImportOpen(false);

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      if (row.error) {
        results[i] = { ...results[i], status: "rejected", message: row.error };
        setImportProgress((p) => ({ ...p, done: p.done + 1 }));
        setImportResults([...results]);
        continue;
      }
      try {
        const packNum = Number(String(row.packSize ?? "").replace(/[^\d-]/g, ""));
        await api.products.create({
          barcode: row.barcode,
          name: row.name,
          company: row.company || undefined,
          category: row.category || undefined,
          location: row.location || undefined,
          purchasePrice: Number(row.purchasePrice),
          salePrice: Number(row.salePrice) || 0,
          expiry: row.expiry || undefined,
          packSize: row.packSize ? (Number.isFinite(packNum) ? packNum : undefined) : undefined,
        });
        results[i] = { ...results[i], status: "completed" };
      } catch (err) {
        results[i] = { ...results[i], status: "rejected", message: err instanceof Error ? err.message : "API error" };
      }
      setImportProgress((p) => ({ ...p, done: p.done + 1 }));
      setImportResults([...results]);
    }

    setImportImporting(false);
    setImportRows([]);
    queryClient.invalidateQueries({ queryKey: ["products"] });

    const completed = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(`${completed} products imported successfully`);
    } else {
      toast.error(`${completed} imported, ${failed} failed`);
    }
  }

  const columns = [
    { key: "barcode", header: "Barcode", cell: (p: Product) => <span className="font-mono text-[11px] text-text-secondary">{p.barcode}</span> },
    { key: "name", header: "Name", cell: (p: Product) => (
      <span className={`text-xs ${p.active ? "font-medium text-text-primary" : "text-text-secondary line-through"}`}>{p.name}</span>
    ) },
    { key: "category", header: "Category", cell: (p: Product) => (
      <span className="text-[10px] text-text-secondary bg-surface-2 px-1.5 py-0.5 rounded">{p.category || "\u2014"}</span>
    ) },
    { key: "location", header: "Location", cell: (p: Product) => <span className="text-[11px] font-mono text-text-secondary">{p.location || "\u2014"}</span> },
    { key: "prices", header: "Prices", cell: (p: Product) => {
      const allPrices = (p as any).prices as { purchasePrice: number; salePrice: number; label?: string }[] | undefined;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs font-semibold text-accent">{formatCurrency(p.sale_price)}</span>
          {allPrices && allPrices.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allPrices.map((pt, i) => (
                <span key={i} className="text-[9px] font-mono text-text-secondary bg-surface-2 px-1 rounded">
                  {formatCurrency(pt.salePrice)}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    } },
    { key: "stockQty", header: "Stock", cell: (p: Product) => (
      <span className={`font-mono text-xs font-semibold ${p.stock_qty <= 5 ? "text-danger" : p.active ? "text-text-primary" : "text-text-secondary"}`}>{p.stock_qty}</span>
    ) },
    { key: "status", header: "Status", cell: (p: Product) => {
      if (!p.active) return <StatusBadge status="inactive" />;
      const s = p.stock_qty <= 0 ? "inactive" : p.stock_qty <= 5 ? "low" : "active";
      return <StatusBadge status={s} />;
    } },
    {
      key: "actions", header: "", cell: (p: Product) => (
        <div className="flex items-center gap-0.5 justify-end">
          {p.active ? (
            <>
              <button onClick={() => openEdit(p)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors" title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => archiveMutation.mutate(p.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-warning hover:bg-warning/5 transition-colors" title="Archive">
                <Archive className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button onClick={() => restoreMutation.mutate(p.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-success hover:bg-success/5 transition-colors" title="Restore">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-0.5">
          <h1 className="text-base font-semibold text-text-primary tracking-tight">Products</h1>
          <p className="text-xs text-text-secondary">Manage your pharmacy inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setCatEditingId(null); setCatName(""); setCatSearch(""); setCatOpen(true); }}>
            <Tags className="h-3.5 w-3.5 mr-1" /> Categories
          </Button>
          <Button onClick={openAdd} className="gap-1.5" size="sm">
            <Plus className="h-3.5 w-3.5" /> Add Product
          </Button>
        </div>
      </div>

      {addedId && (
        <div className="mb-4 p-3 rounded-lg border border-success/20 bg-success/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <p className="text-xs text-text-primary font-medium">Product added successfully</p>
          </div>
          <div className="flex items-center gap-2">
            {lastAddedProduct && (
              <Button size="sm" variant="outline" onClick={() => { setPrintBarcode(lastAddedProduct); }}>
                <Barcode className="h-3.5 w-3.5 mr-1" /> Print Barcode
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { setAddedId(null); openAdd(); }}>Add Another</Button>
            <Button size="sm" onClick={() => setAddedId(null)}>Done</Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
          <Input
            ref={searchRef}
            autoFocus
            placeholder="Search or scan barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && search.trim()) {
                const product = await api.products.getByBarcode(search.trim());
                if (product) {
                  toast.success(`Found: ${product.name}`);
                  setSearch(product.barcode);
                }
              }
            }}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Button variant="outline" size="sm" className={showArchived ? "border-accent text-accent" : ""} onClick={() => { setShowArchived(!showArchived); setPage(1); }}>
            <Archive className="h-3.5 w-3.5 mr-1" />
            Archived
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(`products_${new Date().toISOString().split("T")[0]}.csv`, ["Barcode","Name","Company","Category","Location","Sale Price","Purchase Price","Stock","Expiry","Status"], products.map((p: Product) => [p.barcode, p.name, p.company, p.category, p.location, p.sale_price, p.purchase_price, p.stock_qty, p.expiry||"", p.active?"Active":"Archived"]))}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadPDF(`products_${new Date().toISOString().split("T")[0]}.pdf`, "Products List", ["Barcode","Name","Company","Category","Location","Sale Price","Purchase Price","Stock","Expiry","Status"], products.map((p: Product) => [p.barcode, p.name, p.company, p.category, p.location, p.sale_price, p.purchase_price, p.stock_qty, p.expiry||"", p.active?"Active":"Archived"]))}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          <Button variant="primary" size="sm" onClick={() => { setImportOpen(true); setImportRows([]); }}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPrintBarcode({})}>
            <Barcode className="h-3.5 w-3.5 mr-1" /> Generate Barcode
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <DataTable columns={columns} data={products} loading={isLoading} keyExtractor={(p: Product) => p.id} />
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-text-secondary">
        <span>{total.toLocaleString()} product(s) · page {page} of {totalPages}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={(v) => { if (!v) { setImportRows([]); } setImportOpen(v); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import Products</DialogTitle>
          </DialogHeader>
          {importRows.length === 0 ? (
            <div className="px-5 pb-5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer hover:border-accent/50 transition-colors"
                onClick={handlePickCsv}
              >
                <Upload className="h-8 w-8 text-text-secondary" />
                <div>
                  <p className="text-xs font-medium text-text-primary">Drag & drop your CSV file here</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">or click to browse files</p>
                </div>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); downloadSampleCsv(); }}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download Sample
                </Button>
                <p className="text-[10px] text-text-secondary/60">Supports: barcode, name, purchase price, sale price, category, location, expiry, company, pack size</p>
              </div>
            </div>
          ) : (
            <div className="px-5 pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-secondary">
                  {importRows.length} product(s) found
                </p>
                <Button variant="ghost" size="sm" onClick={() => { setImportRows([]); }}>
                  Choose different file
                </Button>
              </div>
              {importRows.some((r) => r.error) && (
                <div className="p-2.5 rounded-lg bg-danger/5 border border-danger/20 text-[11px] text-danger">
                  {importRows.filter((r) => r.error).length} row(s) have errors and will be skipped
                </div>
              )}
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-2">
                      <th className="text-left p-2 font-medium text-text-secondary text-[10px] uppercase tracking-wider">#</th>
                      <th className="text-left p-2 font-medium text-text-secondary text-[10px] uppercase tracking-wider">Barcode</th>
                      <th className="text-left p-2 font-medium text-text-secondary text-[10px] uppercase tracking-wider">Name</th>
                      <th className="text-left p-2 font-medium text-text-secondary text-[10px] uppercase tracking-wider">Purchase</th>
                      <th className="text-left p-2 font-medium text-text-secondary text-[10px] uppercase tracking-wider">Sale</th>
                      <th className="text-left p-2 font-medium text-text-secondary text-[10px] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className={`border-t border-border ${row.error ? "bg-danger/5" : ""}`}>
                        <td className="p-2 text-text-secondary">{row.rowNum}</td>
                        <td className="p-2 font-mono text-text-primary">{row.barcode}</td>
                        <td className="p-2 text-text-primary font-medium">{row.name}</td>
                        <td className="p-2 text-text-secondary">{row.purchasePrice}</td>
                        <td className="p-2 text-text-secondary">{row.salePrice || "\u2014"}</td>
                        <td className="p-2">
                          {row.error ? (
                            <span className="text-danger text-[10px]" title={row.error}>Error</span>
                          ) : (
                            <span className="text-success text-[10px]">Valid</span>
      )}

      {importImporting && (
        <div className="mb-4 p-3 rounded-lg border border-accent/20 bg-accent/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-text-primary">
              Importing products... {importProgress.done} / {importProgress.total}
            </p>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setImportResultsOpen(true)}>
              View Details
            </Button>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {!importImporting && importResults.length > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-border bg-surface-2 flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            Last import: {importResults.filter((r) => r.status === "completed").length} completed,{" "}
            {importResults.filter((r) => r.status === "rejected").length} failed
          </p>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setImportResultsOpen(true)}>
            View Details
          </Button>
        </div>
      )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importRows.length > 50 && (
                  <p className="text-center text-text-secondary p-2 text-[10px]">...and {importRows.length - 50} more</p>
                )}
              </div>
              <Button className="w-full" disabled={importImporting || importRows.length === 0} onClick={handleImport}>
                {importImporting
                  ? `Importing ${importRows.length} products...`
                  : `Import ${importRows.filter((r) => !r.error).length} Valid Product${importRows.filter((r) => !r.error).length !== 1 ? "s" : ""}`
                }
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingId(null); } setOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-3 max-h-[65vh] overflow-y-auto">
            <div className="space-y-1">
              <Label>Barcode</Label>
              <Input
                ref={barcodeInputRef}
                value={form.barcode}
                onChange={(e) => { setForm({ ...form, barcode: e.target.value }); checkBarcode(e.target.value); }}
                className="font-mono"
              />
              {barcodeExists && (
                <p className="text-[11px] text-danger mt-0.5">{barcodeExists}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: Category) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Shelf A1" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Pack Size (units per pack)</Label>
              <Input type="number" min="1" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} placeholder="e.g. 10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Purchase Price</Label>
                <Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Sale Price</Label>
                <Input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
              </div>
            </div>

            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Additional Price Tiers</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPriceTier} className="h-7 gap-1">
                  <Plus className="h-3 w-3" /> Add Tier
                </Button>
              </div>
              {form.prices.length === 0 && (
                <p className="text-[11px] text-text-secondary">No additional prices.</p>
              )}
              {form.prices.map((pt, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-surface-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-text-secondary">Purchase</Label>
                      <Input
                        type="number"
                        value={pt.purchasePrice}
                        onChange={(e) => updatePriceTier(i, "purchasePrice", e.target.value)}
                        className="h-7 text-[11px]"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-text-secondary">Sale</Label>
                      <Input
                        type="number"
                        value={pt.salePrice}
                        onChange={(e) => updatePriceTier(i, "salePrice", e.target.value)}
                        className="h-7 text-[11px]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removePriceTier(i)}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors mt-4 shrink-0"
                    title="Remove tier"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <Button className="w-full mt-1" disabled={!form.name || !form.purchasePrice || createMutation.isPending || updateMutation.isPending}
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={(v) => { if (!v) { setCatEditingId(null); setCatName(""); } setCatOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-accent" />
              Manage Categories
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder={catEditingId ? "Edit category name..." : "New category name..."}
                autoFocus
              />
              <Button
                disabled={!catName.trim() || catCreateMutation.isPending || catUpdateMutation.isPending}
                onClick={() => catEditingId ? catUpdateMutation.mutate() : catCreateMutation.mutate()}
                className="shrink-0"
              >
                {catCreateMutation.isPending || catUpdateMutation.isPending ? "Saving..." : catEditingId ? "Update" : "Add"}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
              <Input
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="Search categories..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {categories
                .filter((c: Category) => !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase()))
                .map((cat: Category) => (
                  <div key={cat.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <span className="text-sm text-text-primary truncate">{cat.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setCatEditingId(cat.id); setCatName(cat.name); }}
                        className="h-6 w-6 rounded flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setCatDeleteId(cat.id)}
                        className="h-6 w-6 rounded flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              {categories.length === 0 && (
                <p className="text-xs text-text-secondary text-center py-6">No categories yet.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!catDeleteId}
        onOpenChange={(v) => { if (!v) setCatDeleteId(null); }}
        title="Delete Category"
        description="Are you sure you want to delete this category? Products assigned to it will not be affected."
        confirmLabel="Delete"
        onConfirm={() => { if (catDeleteId) catDeleteMutation.mutate(catDeleteId); }}
        loading={catDeleteMutation.isPending}
      />

      <Dialog open={importResultsOpen} onOpenChange={(v) => { if (!v) setImportResultsOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 max-h-80 overflow-y-auto space-y-1">
            {importResults.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-4">No import data.</p>
            ) : (
              importResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                    r.status === "completed"
                      ? "border-success/20 bg-success/5"
                      : r.status === "rejected"
                      ? "border-danger/20 bg-danger/5"
                      : "border-border bg-surface-2"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-text-primary truncate block">{r.name}</span>
                    <span className="font-mono text-[10px] text-text-secondary">{r.barcode}</span>
                  </div>
                  <div className="shrink-0 ml-2 text-right">
                    <span className={`text-[10px] font-medium ${
                      r.status === "completed" ? "text-success" : r.status === "rejected" ? "text-danger" : "text-text-secondary"
                    }`}>
                      {r.status === "completed" ? "Done" : r.status === "rejected" ? "Failed" : "Pending"}
                    </span>
                    {r.message && <p className="text-[9px] text-danger mt-0.5 max-w-[200px] truncate" title={r.message}>{r.message}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PrintBarcodeDialog
        open={!!printBarcode}
        onOpenChange={(v) => { if (!v) setPrintBarcode(null); }}
        barcode={printBarcode?.barcode}
      />
    </div>
  );
}
