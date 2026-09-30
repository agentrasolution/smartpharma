"use client";

import { generateReceiptHTML, generateReturnReceiptHTML } from "./receiptGenerator";
import type { PrinterConfig } from "@/types";

export function initWebPolyfill() {
  if (typeof window === "undefined") return;

  // Window receipt generation
  window.generateReceiptHTML = async (sale: unknown, paperSize?: string) => {
    return generateReceiptHTML(sale, paperSize || "thermal");
  };

  window.generateReturnReceiptHTML = async (returnData: unknown, sale: unknown, paperSize?: string) => {
    return generateReturnReceiptHTML(returnData, sale, paperSize || "thermal");
  };

  // Web printing via hidden iframe
  window.printReceipt = async (sale: unknown, printerConfig?: PrinterConfig) => {
    try {
      const res = generateReceiptHTML(sale, printerConfig?.paperSize || "thermal");
      if (!res.success || !res.html) throw new Error(res.error || "Failed to generate receipt");

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) throw new Error("Could not access print frame");

      doc.open();
      doc.write(res.html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 1000);
      }, 250);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Print failed" };
    }
  };

  window.printReturnReceipt = async (returnData: unknown, sale: unknown, printerConfig?: PrinterConfig) => {
    try {
      const res = generateReturnReceiptHTML(returnData, sale, printerConfig?.paperSize || "thermal");
      if (!res.success || !res.html) throw new Error(res.error || "Failed to generate return receipt");

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) throw new Error("Could not access print frame");

      doc.open();
      doc.write(res.html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 1000);
      }, 250);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Print failed" };
    }
  };

  window.printBarcodeLabel = async (barcode: string, copies: number, svgHtml?: string) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) throw new Error("Could not access print frame");

      const labelContent = svgHtml || `<div style="font-family: monospace; font-size: 14px; text-align: center;">${barcode}</div>`;
      const html = `<!DOCTYPE html><html><head><title>Print Barcode</title><style>@page{margin:0;size:auto;}body{margin:4px;display:flex;flex-direction:column;align-items:center;}</style></head><body>${Array(copies).fill(labelContent).join("<div style='page-break-after:always;'></div>")}</body></html>`;

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 1000);
      }, 250);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Barcode print failed" };
    }
  };

  window.openPosWindow = async () => {
    try {
      window.open("/pos?pos=1", "_blank", "width=1280,height=900");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not open window" };
    }
  };

  window.getPosWindowCount = async () => 0;

  window.toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return { success: true, fullscreen: false };
      } else {
        await document.documentElement.requestFullscreen();
        return { success: true, fullscreen: true };
      }
    } catch {
      return { success: false };
    }
  };

  if (!window.electronAPI) {
    (window as any).electronAPI = {
      printers: {
        list: async () => [
          { name: "Default System Printer", displayName: "Default System / Thermal", isDefault: true },
          { name: "80mm POS Thermal Printer", displayName: "80mm Thermal Receipt", isDefault: false },
        ],
        getConfig: async () => {
          try {
            const raw = localStorage.getItem("smartpharma_printer_cfg");
            return raw ? JSON.parse(raw) : { paperSize: "thermal", copies: 1 };
          } catch {
            return { paperSize: "thermal", copies: 1 };
          }
        },
        saveConfig: async (cfg: PrinterConfig) => {
          try {
            localStorage.setItem("smartpharma_printer_cfg", JSON.stringify(cfg));
            return { success: true };
          } catch {
            return { success: false };
          }
        },
      },
      pos: {
        openWindow: async () => {
          window.open("/pos?pos=1", "_blank");
          return { success: true };
        },
        getWindowCount: async () => 0,
      },
      settings: {
        backupCreate: async () => ({ success: true, name: "cloud-backup.db" }),
        backupList: async () => [],
        backupDelete: async () => ({ success: true }),
        backupRestore: async () => ({ success: true }),
        backupDirectoryPick: async () => ({ canceled: true }),
        getBackupDirectory: async () => ({ path: "/cloud" }),
        gdriveGetConfig: async () => ({ clientId: "", clientSecret: "", redirectUri: "", refreshToken: "", autoUpload: false, connected: false }),
        gdriveSaveConfig: async () => ({ success: true }),
      },
    };
  }
}
