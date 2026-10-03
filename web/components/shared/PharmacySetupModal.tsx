"use client";

import { useState, useEffect } from "react";
import { Building2, Globe, Coins, MapPin, Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import CountrySelect from "./CountrySelect";
import { CURRENCIES, findCountry, type Country } from "@/lib/countries";

export default function PharmacySetupModal() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const profile = user?.pharmacyProfile;

  const [countryCode, setCountryCode] = useState("SA");
  const [countryName, setCountryName] = useState("Saudi Arabia");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    // Only prompt admin users whose pharmacy profile has not configured country or currency
    if (!user || user.role !== "admin") return;

    const p = user.pharmacyProfile;
    const isUnconfigured = !p?.countryCode || !p?.currency || !p?.city;
    const sessionDismissed = sessionStorage.getItem("smartpharma_setup_prompt_dismissed");

    if (isUnconfigured && !sessionDismissed) {
      if (p?.countryCode) {
        setCountryCode(p.countryCode);
        setCountryName(p.countryName || "");
      }
      if (p?.city) setCity(p.city);
      if (p?.currency) setCurrency(p.currency);
      if (p?.phone) setPhone(p.phone);
      if (p?.address) setAddress(p.address);
      setOpen(true);
    }
  }, [user]);

  function handleCountrySelect(country: Country) {
    setCountryCode(country.code);
    setCountryName(country.name);
    setCurrency(country.currency);
    if (!phone || phone.startsWith("+")) {
      setPhone(country.dialCode + " ");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) {
      toast.error("City is required");
      return;
    }
    setSaving(true);
    try {
      await api.pharmacy.update({
        countryCode,
        countryName,
        city: city.trim(),
        currency,
        phone: phone.trim(),
        address: address.trim(),
      });
      localStorage.setItem("smartpharma_currency", currency);
      toast.success("Pharmacy details updated successfully!");
      await refreshUser();
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update pharmacy details";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem("smartpharma_setup_prompt_dismissed", "true");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleDismiss()}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader className="space-y-2">
          <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-1">
            <Building2 className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-bold">Complete Pharmacy Configuration</DialogTitle>
          <DialogDescription className="text-xs text-text-secondary leading-relaxed">
            Please confirm your country, base operating currency, and pharmacy location to configure tax, invoicing, and POS shifts correctly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Country Selection */}
          <CountrySelect
            value={countryCode}
            onChange={handleCountrySelect}
            label="Country"
          />

          <div className="grid grid-cols-2 gap-3">
            {/* City */}
            <div className="space-y-1.5">
              <Label htmlFor="setup-city" className="text-[11px] uppercase tracking-wider text-text-secondary">
                City *
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                <Input
                  id="setup-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Riyadh"
                  className="pl-8 h-10 text-xs"
                  required
                />
              </div>
            </div>

            {/* Base Currency */}
            <div className="space-y-1.5">
              <Label htmlFor="setup-currency" className="text-[11px] uppercase tracking-wider text-text-secondary">
                Base Currency *
              </Label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                <select
                  id="setup-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-10 pl-8 pr-3 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60 transition-all appearance-none cursor-pointer"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="setup-phone" className="text-[11px] uppercase tracking-wider text-text-secondary">
              Pharmacy Contact Phone
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
              <Input
                id="setup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+966 50 000 0000"
                className="pl-8 h-10 text-xs"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="setup-address" className="text-[11px] uppercase tracking-wider text-text-secondary">
              Physical Street Address
            </Label>
            <Input
              id="setup-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. King Fahd Road, Al Olaya"
              className="h-10 text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Remind me next login
            </Button>

            <Button
              type="submit"
              disabled={saving || !city.trim()}
              className="h-10 px-5 text-xs font-semibold gap-2"
            >
              {saving ? "Saving..." : "Save Configuration"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
