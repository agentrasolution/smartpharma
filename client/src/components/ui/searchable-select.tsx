import * as React from "react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder, className }: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary ring-offset-background focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 transition-colors"
      >
        <span className={selected ? "" : "text-text-secondary/60"}>
          {selected?.label || placeholder || "Select..."}
        </span>
        <svg className="h-3.5 w-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
          <div className="p-1">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-xs text-text-secondary text-center">No results</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors",
                    opt.value === value
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-text-primary hover:bg-surface-2"
                  )}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
