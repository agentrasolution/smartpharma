"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Barcode, Printer, LayoutGrid, List, Plus, Trash2, Tags, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import PrintBarcodeDialog from "@/components/shared/PrintBarcodeDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn, renderBarcode } from "@/lib/utils";
import type { BarcodeEntry } from "@/types";

export default function Barcodes() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [printTarget, setPrintTarget] = useState<string | undefined>(undefined);
  const [printOpen, setPrintOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BarcodeEntry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: barcodes = [], isLoading } = useQuery({
    queryKey: ["barcodes"],
    queryFn: api.barcodes.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.barcodes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      setDeleteTarget(null);
    },
  });

  const filtered = useMemo(() => {
    if (!barcodes) return [];
    const q = search.toLowerCase().trim();
    if (!q) return barcodes;
    return barcodes.filter(
      (b) =>
        b.code.toLowerCase().includes(q) ||
        (b.product && b.product.name.toLowerCase().includes(q))
    );
  }, [barcodes, search]);

  const assignedCount = useMemo(
    () => barcodes.filter((b) => b.productId || b.product).length,
    [barcodes]
  );
  const customCount = useMemo(
    () => barcodes.filter((b) => !b.productId && !b.product).length,
    [barcodes]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (view !== "grid" || !filtered.length) return;
    const timer = requestAnimationFrame(() => {
      filtered.forEach((b) => {
        const el = document.getElementById(`bc-${b.id}`) as unknown as SVGElement | null;
        if (!el) return;
        renderBarcode(el, b.code, {
          width: 1.5,
          height: 40,
          displayValue: false,
          margin: 0,
          fontSize: 12,
        });
      });
    });
    return () => cancelAnimationFrame(timer);
  }, [filtered, view]);

  function openPrint(barcode: string) {
    setPrintTarget(barcode);
    setPrintOpen(true);
  }

  function openGenerate() {
    setPrintTarget(undefined);
    setPrintOpen(true);
  }

  function handleDelete(b: BarcodeEntry) {
    if (b.productId) return;
    setDeleteTarget(b);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  }

  const listColumns = [
    {
      key: "code",
      header: "Barcode Code",
      cell: (b: BarcodeEntry) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Barcode className="h-4 w-4" />
          </div>
          <span className="font-mono text-xs font-semibold text-text-primary tracking-wider">{b.code}</span>
        </div>
      ),
    },
    {
      key: "product",
      header: "Assigned Product",
      cell: (b: BarcodeEntry) =>
        b.product ? (
          <div>
            <span className="font-semibold text-text-primary text-xs">{b.product.name}</span>
            <p className="text-[11px] text-text-secondary mt-0.5">Medicine Catalog Item</p>
          </div>
        ) : (
          <span className="text-xs text-text-secondary italic">Unassigned Custom Tag</span>
        ),
    },
    {
      key: "type",
      header: "Tag Type",
      cell: (b: BarcodeEntry) =>
        b.productId ? (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-success/10 text-success font-medium border border-success/20">
            Product Assigned
          </span>
        ) : (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium border border-purple-500/20">
            Custom Tag
          </span>
        ),
      className: "text-center",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (b: BarcodeEntry) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openPrint(b.code)}
            className="h-7 px-2.5 text-xs rounded-lg gap-1 border-border/80 hover:bg-surface-2 font-medium"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </Button>
          {!b.productId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(b)}
              className="h-7 w-7 p-0 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/5"
              title="Delete custom barcode"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode Generator & Printing"
        description="Generate standard Code 128 barcodes, preview labels, and print shelf tags for medicine inventory."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-accent/10 text-accent font-semibold border border-accent/20">
            {barcodes.length} Barcodes
          </span>
        }
        action={{
          label: "Generate Barcode",
          onClick: openGenerate,
          icon: <Plus className="h-3.5 w-3.5" />,
        }}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Barcodes"
          value={barcodes.length}
          icon={<Barcode className="h-5 w-5" />}
          color="accent"
          loading={isLoading}
          subtitle="Catalog label identifiers"
        />
        <StatCard
          title="Linked Products"
          value={assignedCount}
          icon={<Tags className="h-5 w-5" />}
          color="success"
          loading={isLoading}
          subtitle={`${customCount} unassigned custom tags`}
        />
        <StatCard
          title="Format Standard"
          value="Code 128"
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="purple"
          subtitle="GS1 & Retail Standard Compliant"
        />
      </div>

      {/* Standardized Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-border/80 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by barcode or product name..."
            className="pl-9 h-9 rounded-xl text-xs bg-surface-2/40 border-border/80 focus:bg-surface"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center p-0.5 bg-surface-2/60 rounded-xl border border-border/60">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors",
                view === "grid"
                  ? "bg-surface text-text-primary shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors",
                view === "list"
                  ? "bg-surface text-text-primary shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-surface p-8 shadow-xs">
          <EmptyState
            title="No barcodes found"
            description={
              search
                ? `No barcodes match "${search}". Try searching another name or code.`
                : "No barcode labels generated yet. Generate your first barcode to print tags for your stock."
            }
            icon={<Barcode className="h-6 w-6 text-accent" />}
            action={
              <Button onClick={openGenerate} size="sm" className="h-9 rounded-xl text-xs gap-1.5 font-medium shadow-xs">
                <Plus className="h-3.5 w-3.5" /> Generate First Barcode
              </Button>
            }
          />
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="group relative flex flex-col items-center justify-between p-4 rounded-2xl border border-border/80 bg-surface shadow-xs hover:shadow-md hover:border-accent/30 transition-all duration-200"
            >
              {!b.productId && (
                <button
                  onClick={() => handleDelete(b)}
                  className="absolute top-2.5 right-2.5 h-6 w-6 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Delete custom barcode"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="flex items-center justify-center w-full min-h-[56px] py-1 bg-white/70 dark:bg-white/10 rounded-xl mb-2 px-2 border border-border/40">
                <svg id={`bc-${b.id}`} className="max-w-full h-[46px]" />
              </div>
              <div className="w-full text-center mb-3">
                <span className="inline-block text-[11px] font-mono font-semibold text-text-primary bg-surface-2/80 px-2 py-0.5 rounded-md border border-border/60 break-all mb-1.5">
                  {b.code}
                </span>
                <p className="text-xs font-medium text-text-primary line-clamp-2 min-h-[2rem] leading-tight">
                  {b.product ? (
                    b.product.name
                  ) : (
                    <span className="text-text-secondary italic text-xs">Unassigned Custom Tag</span>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPrint(b.code)}
                className="w-full h-8 rounded-xl text-xs gap-1.5 border-border/80 hover:bg-surface-2 font-medium"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Label
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={listColumns}
          data={filtered}
          keyExtractor={(b) => b.id}
          emptyTitle="No barcodes found"
        />
      )}

      <PrintBarcodeDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        barcode={printTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Delete Barcode"
        description={`Are you sure you want to delete barcode "${deleteTarget?.code}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
