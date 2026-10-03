"use client";
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "./EmptyState";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  containerClassName?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (newPage: number) => void;
  totalCount?: number;
  itemLabel?: string;
}

export default function DataTable<T>({
  columns,
  data,
  loading,
  keyExtractor,
  onRowClick,
  emptyMessage,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  containerClassName,
  page,
  totalPages,
  onPageChange,
  totalCount,
  itemLabel = "items",
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-border/80 bg-surface overflow-hidden shadow-xs", containerClassName)}>
        <Table>
          <TableHeader className="bg-surface-2/60">
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={cn("text-[11px] font-semibold text-text-secondary uppercase tracking-wider py-3 px-4", col.className)}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-b border-border/50">
                {columns.map((col) => (
                  <TableCell key={col.key} className="py-3.5 px-4">
                    <Skeleton className="h-4 w-full max-w-[120px] rounded-md" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-surface overflow-hidden shadow-xs", containerClassName)}>
      <Table>
        <TableHeader className="bg-surface-2/60 border-b border-border/80">
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={cn("text-[11px] font-semibold text-text-secondary uppercase tracking-wider py-3.5 px-4", col.className)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0 border-0">
                <EmptyState
                  title={emptyTitle || emptyMessage || "No data found"}
                  description={emptyDescription}
                  icon={emptyIcon}
                  action={emptyAction}
                />
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow
                key={keyExtractor(item)}
                className={cn(
                  "border-b border-border/50 transition-colors hover:bg-surface-2/40 last:border-0",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={cn("py-3.5 px-4 text-xs align-middle", col.className)}>
                    {col.cell(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages !== undefined && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/80 bg-surface text-xs text-text-secondary">
          <div>
            {totalCount !== undefined ? (
              <span>
                Showing <strong className="text-text-primary font-mono">{data.length}</strong> of{" "}
                <strong className="text-text-primary font-mono">{totalCount}</strong> {itemLabel}
              </span>
            ) : (
              <span>
                Page <strong className="text-text-primary font-mono">{page}</strong> of{" "}
                <strong className="text-text-primary font-mono">{totalPages}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 rounded-lg text-xs"
              onClick={() => onPageChange((page || 1) - 1)}
              disabled={(page || 1) <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 rounded-lg text-xs"
              onClick={() => onPageChange((page || 1) + 1)}
              disabled={(page || 1) >= totalPages}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
