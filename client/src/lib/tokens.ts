/**
 * Faraz Pharmacy Design System
 * Premium, clinical, modern, restrained
 */

export const tokens = {
  colors: {
    light: {
      background: "#F5F7F9",
      surface: "#FFFFFF",
      elevated: "#FFFFFF",
      text: "#0F172A",
      muted: "#64748B",
      border: "#E2E8F0",
      primary: "#0D9488",
      primaryHover: "#0F766E",
    },
    dark: {
      background: "#0F172A",
      surface: "#111827",
      elevated: "#1E293B",
      text: "#F8FAFC",
      muted: "#94A3B8",
      border: "#334155",
      primary: "#14B8A6",
      primaryHover: "#2DD4BF",
    },
    semantic: {
      success: "#16A34A",
      warning: "#D97706",
      danger: "#DC2626",
      info: "#2563EB",
    },
  },

  animation: {
    hover: "100-150ms",
    dropdown: "150-200ms",
    modal: "150-200ms",
    toast: "200ms",
  },

  principles: {
    style: "premium, clinical, modern, restrained",
    typography: "Inter / Inter Tight / JetBrains Mono",
    interaction: "keyboard-first",
    pos: "optimized for barcode scanning and rapid transactions",
    dashboard: "operationally useful, not decorative",
    tables: "dense data, generous row height",
    animation: "subtle and functional",
  },
} as const;

export type DesignTokens = typeof tokens;
