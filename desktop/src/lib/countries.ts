export interface Country {
  code: string;
  name: string;
  dialCode: string;
  currency: string;
  currencySymbol: string;
  flag: string;
}

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export const COUNTRIES: Country[] = [
  // Primary regional & high-volume markets first
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", currency: "SAR", currencySymbol: "SAR", flag: "🇸🇦" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", currency: "AED", currencySymbol: "AED", flag: "🇦🇪" },
  { code: "PK", name: "Pakistan", dialCode: "+92", currency: "PKR", currencySymbol: "Rs", flag: "🇵🇰" },
  { code: "EG", name: "Egypt", dialCode: "+20", currency: "EGP", currencySymbol: "EGP", flag: "🇪🇬" },
  { code: "KW", name: "Kuwait", dialCode: "+965", currency: "KWD", currencySymbol: "KD", flag: "🇰🇼" },
  { code: "QA", name: "Qatar", dialCode: "+974", currency: "QAR", currencySymbol: "QR", flag: "🇶🇦" },
  { code: "OM", name: "Oman", dialCode: "+968", currency: "OMR", currencySymbol: "OMR", flag: "🇴🇲" },
  { code: "BH", name: "Bahrain", dialCode: "+973", currency: "BHD", currencySymbol: "BD", flag: "🇧🇭" },
  { code: "JO", name: "Jordan", dialCode: "+962", currency: "JOD", currencySymbol: "JD", flag: "🇯🇴" },
  { code: "US", name: "United States", dialCode: "+1", currency: "USD", currencySymbol: "$", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", currency: "GBP", currencySymbol: "£", flag: "🇬🇧" },
  { code: "CA", name: "Canada", dialCode: "+1", currency: "CAD", currencySymbol: "CA$", flag: "🇨🇦" },
  { code: "AU", name: "Australia", dialCode: "+61", currency: "AUD", currencySymbol: "A$", flag: "🇦🇺" },
  { code: "IN", name: "India", dialCode: "+91", currency: "INR", currencySymbol: "₹", flag: "🇮🇳" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", currency: "BDT", currencySymbol: "৳", flag: "🇧🇩" },
  { code: "TR", name: "Turkey", dialCode: "+90", currency: "TRY", currencySymbol: "₺", flag: "🇹🇷" },
  { code: "DE", name: "Germany", dialCode: "+49", currency: "EUR", currencySymbol: "€", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", currency: "EUR", currencySymbol: "€", flag: "🇫🇷" },
  { code: "ES", name: "Spain", dialCode: "+34", currency: "EUR", currencySymbol: "€", flag: "🇪🇸" },
  { code: "IT", name: "Italy", dialCode: "+39", currency: "EUR", currencySymbol: "€", flag: "🇮🇹" },
  { code: "ZA", name: "South Africa", dialCode: "+27", currency: "ZAR", currencySymbol: "R", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dialCode: "+234", currency: "NGN", currencySymbol: "₦", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dialCode: "+254", currency: "KES", currencySymbol: "KSh", flag: "🇰🇪" },
  { code: "GH", name: "Ghana", dialCode: "+233", currency: "GHS", currencySymbol: "GH₵", flag: "🇬🇭" },
  { code: "MY", name: "Malaysia", dialCode: "+60", currency: "MYR", currencySymbol: "RM", flag: "🇲🇾" },
  { code: "SG", name: "Singapore", dialCode: "+65", currency: "SGD", currencySymbol: "S$", flag: "🇸🇬" },
  { code: "PH", name: "Philippines", dialCode: "+63", currency: "PHP", currencySymbol: "₱", flag: "🇵🇭" },
  { code: "ID", name: "Indonesia", dialCode: "+62", currency: "IDR", currencySymbol: "Rp", flag: "🇮🇩" },
  { code: "NZ", name: "New Zealand", dialCode: "+64", currency: "NZD", currencySymbol: "NZ$", flag: "🇳🇿" },
  { code: "IE", name: "Ireland", dialCode: "+353", currency: "EUR", currencySymbol: "€", flag: "🇮🇪" },
  { code: "NL", name: "Netherlands", dialCode: "+31", currency: "EUR", currencySymbol: "€", flag: "🇳🇱" },
  { code: "SE", name: "Sweden", dialCode: "+46", currency: "SEK", currencySymbol: "kr", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", dialCode: "+41", currency: "CHF", currencySymbol: "CHF", flag: "🇨🇭" },
  { code: "NO", name: "Norway", dialCode: "+47", currency: "NOK", currencySymbol: "kr", flag: "🇳🇴" },
  { code: "LB", name: "Lebanon", dialCode: "+961", currency: "USD", currencySymbol: "$", flag: "🇱🇧" },
  { code: "IQ", name: "Iraq", dialCode: "+964", currency: "IQD", currencySymbol: "IQD", flag: "🇮🇶" },
  { code: "YE", name: "Yemen", dialCode: "+967", currency: "YER", currencySymbol: "YER", flag: "🇾🇪" },
  { code: "SD", name: "Sudan", dialCode: "+249", currency: "SDG", currencySymbol: "SDG", flag: "🇸🇩" },
  { code: "MA", name: "Morocco", dialCode: "+212", currency: "MAD", currencySymbol: "MAD", flag: "🇲🇦" },
  { code: "TN", name: "Tunisia", dialCode: "+216", currency: "TND", currencySymbol: "DT", flag: "🇹🇳" },
  { code: "DZ", name: "Algeria", dialCode: "+213", currency: "DZD", currencySymbol: "DA", flag: "🇩🇿" },
];

export const CURRENCIES: CurrencyOption[] = [
  { code: "SAR", name: "Saudi Riyal (SAR)", symbol: "SAR" },
  { code: "AED", name: "UAE Dirham (AED)", symbol: "AED" },
  { code: "USD", name: "US Dollar ($)", symbol: "$" },
  { code: "PKR", name: "Pakistani Rupee (PKR)", symbol: "Rs" },
  { code: "EUR", name: "Euro (€)", symbol: "€" },
  { code: "GBP", name: "British Pound (£)", symbol: "£" },
  { code: "KWD", name: "Kuwaiti Dinar (KWD)", symbol: "KD" },
  { code: "QAR", name: "Qatari Riyal (QAR)", symbol: "QR" },
  { code: "OMR", name: "Omani Rial (OMR)", symbol: "OMR" },
  { code: "BHD", name: "Bahraini Dinar (BHD)", symbol: "BD" },
  { code: "EGP", name: "Egyptian Pound (EGP)", symbol: "EGP" },
  { code: "JOD", name: "Jordanian Dinar (JOD)", symbol: "JD" },
  { code: "INR", name: "Indian Rupee (INR)", symbol: "₹" },
  { code: "CAD", name: "Canadian Dollar (CAD)", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar (AUD)", symbol: "A$" },
  { code: "TRY", name: "Turkish Lira (TRY)", symbol: "₺" },
  { code: "MYR", name: "Malaysian Ringgit (MYR)", symbol: "RM" },
  { code: "SGD", name: "Singapore Dollar (SGD)", symbol: "S$" },
];

export function findCountry(codeOrName: string): Country | undefined {
  if (!codeOrName) return undefined;
  const normalized = codeOrName.trim().toLowerCase();
  return COUNTRIES.find(
    (c) =>
      c.code.toLowerCase() === normalized ||
      c.name.toLowerCase() === normalized ||
      c.dialCode === normalized,
  );
}

export function getDialCode(countryCode: string): string {
  const c = findCountry(countryCode);
  return c?.dialCode || "+966";
}

export function getDefaultCurrency(countryCode: string): string {
  const c = findCountry(countryCode);
  return c?.currency || "SAR";
}
