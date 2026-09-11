import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Barcode, Printer, LayoutGrid, List, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { cn, renderBarcode } from "@/lib/utils";
import PrintBarcodeDialog from "@/components/shared/PrintBarcodeDialog";
import type { BarcodeEntry } from "@/types";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

const cardAnim = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
};

export default function Barcodes() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [printTarget, setPrintTarget] = useState<string | undefined>(undefined);
  const [printOpen, setPrintOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BarcodeEntry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: barcodes, isLoading } = useQuery({
    queryKey: ["barcodes"],
    queryFn: api.barcodes.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.barcodes.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["barcodes"] }),
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getBarcodeId = useCallback(() => {
    return `bc-${Math.random().toString(36).slice(2, 9)}`;
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
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
          <Input
            ref={inputRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by barcode or product name..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "h-7 w-7 flex items-center justify-center transition-colors",
                view === "grid"
                  ? "bg-accent text-accent-foreground"
                  : "text-text-secondary hover:text-text-primary hover:bg-muted"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "h-7 w-7 flex items-center justify-center transition-colors",
                view === "list"
                  ? "bg-accent text-accent-foreground"
                  : "text-text-secondary hover:text-text-primary hover:bg-muted"
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" onClick={openGenerate} className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Generate Barcode
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-xs text-text-secondary">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-text-secondary">
          <Barcode className="h-8 w-8 opacity-30" />
          <p className="text-xs">{search ? "No barcodes match your search" : "No barcodes yet"}</p>
          {!search && (
            <Button variant="outline" size="sm" onClick={openGenerate} className="text-xs gap-1">
              <Plus className="h-3 w-3" />
              Generate your first barcode
            </Button>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="flex-1 overflow-y-auto">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5"
          >
            {filtered.map((b) => (
              <motion.div
                key={b.id}
                variants={cardAnim}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-surface hover:border-accent/40 transition-colors group relative"
              >
                {!b.productId && (
                  <button
                    onClick={() => handleDelete(b)}
                    className="absolute top-1.5 right-1.5 h-5 w-5 rounded flex items-center justify-center text-text-secondary/40 hover:text-danger hover:bg-danger/5 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <div className="flex items-center justify-center w-full min-h-[52px]">
                  <svg id={`bc-${b.id}`} className="max-w-full h-[52px]" />
                </div>
                <span className="text-[10px] text-text-secondary font-mono tracking-wider text-center leading-tight break-all">
                  {b.code}
                </span>
                <span className="text-[11px] font-medium text-text-primary text-center leading-tight line-clamp-2 min-h-[2.5em]">
                  {b.product ? b.product.name : <span className="text-text-secondary italic text-[10px]">No product</span>}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openPrint(b.code)}
                  className="w-full h-7 text-[10px] gap-1.5 mt-auto opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                >
                  <Printer className="h-3 w-3" />
                  Print
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-[10px] font-medium text-text-secondary text-left px-3 py-2">Barcode</th>
                  <th className="text-[10px] font-medium text-text-secondary text-left px-3 py-2">Product</th>
                  <th className="text-[10px] font-medium text-text-secondary text-right px-3 py-2 w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-surface-2/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[11px] text-text-primary tracking-wider">{b.code}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {b.product ? (
                        <span className="text-xs text-text-primary">{b.product.name}</span>
                      ) : (
                        <span className="text-xs text-text-secondary italic">No product</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openPrint(b.code)} className="h-7 text-[10px] gap-1.5">
                          <Printer className="h-3 w-3" />
                          Print
                        </Button>
                        {!b.productId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(b)}
                            className="h-7 w-7 p-0 text-text-secondary/40 hover:text-danger hover:border-danger/30"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PrintBarcodeDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        barcode={printTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Barcode</AlertDialogTitle>
            <AlertDialogDescription>
              Delete barcode <span className="font-mono font-medium">{deleteTarget?.code}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              onClick={confirmDelete}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
