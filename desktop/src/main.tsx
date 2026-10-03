import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./globals.css";

import { generateReceiptHTML, generateReturnReceiptHTML, generateXReportHTML, generateZReportHTML, printHtml } from "./lib/receiptGenerator";

try {
  if (localStorage.getItem("faraz_theme") === "dark") {
    document.documentElement.classList.add("dark");
  }
} catch {}

if (typeof window !== "undefined") {
  if (!window.generateReceiptHTML) {
    window.generateReceiptHTML = async (sale: unknown, paperSize?: string) => generateReceiptHTML(sale, paperSize);
  }
  if (!window.generateReturnReceiptHTML) {
    window.generateReturnReceiptHTML = async (returnData: unknown, sale: unknown, paperSize?: string) => generateReturnReceiptHTML(returnData, sale, paperSize);
  }
  if (!window.generateXReportHTML) {
    window.generateXReportHTML = async (report: unknown) => generateXReportHTML(report);
  }
  if (!window.generateZReportHTML) {
    window.generateZReportHTML = async (report: unknown) => generateZReportHTML(report);
  }
  if (!window.printXReport) {
    window.printXReport = async (report: unknown) => {
      const res = generateXReportHTML(report);
      if (!res.success || !res.html) return { success: false, error: res.error || "Failed" };
      return printHtml(res.html);
    };
  }
  if (!window.printZReport) {
    window.printZReport = async (report: unknown) => {
      const res = generateZReportHTML(report);
      if (!res.success || !res.html) return { success: false, error: res.error || "Failed" };
      return printHtml(res.html);
    };
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
