import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { COUNTRIES, findCountry, type Country } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CountrySelectProps {
  value: string; // ISO country code e.g. "SA"
  onChange: (country: Country) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export default function CountrySelect({
  value,
  onChange,
  label = "Country",
  disabled = false,
  className,
  id = "country-select",
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = findCountry(value) || COUNTRIES[0]!;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  const filteredCountries = COUNTRIES.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.currency.toLowerCase().includes(q)
    );
  });

  return (
    <div className={cn("space-y-1.5 relative", className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-[11px] font-medium tracking-wide uppercase text-text-secondary select-none"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full h-10 rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary",
          "flex items-center justify-between gap-2 text-left cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60",
          "transition-all duration-150",
          disabled && "opacity-50 cursor-not-allowed",
          open && "ring-2 ring-accent/30 border-accent/60",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-lg leading-none">{selectedCountry.flag}</span>
          <span className="font-medium text-text-primary truncate">{selectedCountry.name}</span>
          <span className="text-xs text-text-secondary">({selectedCountry.dialCode})</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-text-secondary shrink-0 transition-transform duration-200",
            open && "rotate-180 text-accent",
          )}
        />
      </button>

      {/* Dropdown Popover */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-border bg-surface/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or dial code..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/60"
              />
            </div>
          </div>

          {/* List of Countries */}
          <div className="max-h-56 overflow-y-auto divide-y divide-border/40 p-1">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-secondary">
                No matching countries found
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.code === selectedCountry.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors text-left",
                      isSelected
                        ? "bg-accent/10 text-accent font-medium"
                        : "hover:bg-surface text-text-primary",
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[11px] text-text-secondary">
                      <span className="font-mono">{c.dialCode}</span>
                      <span className="px-1.5 py-0.5 rounded bg-surface/80 border border-border/60 text-[10px] uppercase font-semibold">
                        {c.currency}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-accent" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
