import type {
  Product, ProductInput, Customer, CustomerInput, Sale, SaleInput,
  Arrear, ArrearInput, StockPurchase, StockInput, Distributor, DistributorInput,
  Company, CompanyInput, ReturnEntry, ReturnInput, Expense, ExpenseInput,
  Category, CategoryInput, DashboardStats, BarcodeEntry, Paginated,
  AISummary, AIReorderCandidate, RiskLevel, AIRecommendation,
  AIRecommendationSummary, AIChatReply, AIConversation, AIConversationDetail,
  AIAuditLog, PurchaseOrder, PurchaseOrderStatus,
  AIConfig, AITestResult,
} from "@/types";
import type { BackupResult, BackupEntry, GDriveConfig } from "@/types/electron";

function getApiUrl(): string {
  const cfg = window.appConfig?.serverUrl?.trim();
  if (cfg) return cfg;
  return import.meta.env.VITE_API_URL?.trim() || "http://localhost:3001";
}

function getToken(): string | null {
  return localStorage.getItem("faraz_access_token");
}

async function fetchJson<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

const api = {
  auth: {
    login: (username: string, password: string): Promise<{
      accessToken: string; refreshToken: string; csrfToken: string;
      user: { id: string; username: string; role: string };
    }> =>
      fetchJson("POST", "/api/auth/login", { username, password }, false),
    refresh: (refreshToken: string): Promise<{
      accessToken: string; refreshToken: string; csrfToken: string;
      user: { id: string; username: string; role: string };
    }> =>
      fetchJson("POST", "/api/auth/refresh", { refreshToken }, false),
    logout: (accessToken: string): Promise<{ success: boolean }> =>
      fetchJson("POST", "/api/auth/logout", { accessToken }),
    verifyPassword: (password: string): Promise<{ valid: boolean }> =>
      fetchJson("POST", "/api/auth/verify-password", { password }, false),
    generateRecoveryKey: (): Promise<{ phrase: string }> =>
      fetchJson("POST", "/api/auth/generate-recovery-key", undefined, false),
    recoverPassword: (phrase: string, newPassword: string): Promise<{ success: boolean; error?: string }> =>
      fetchJson("POST", "/api/auth/recover-password", { phrase, newPassword }, false),
  },
  products: {
    list: (opts?: { page?: number; pageSize?: number; search?: string; includeArchived?: boolean }): Promise<Paginated<Product>> => {
      const params = new URLSearchParams();
      if (opts?.page) params.set("page", String(opts.page));
      if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
      if (opts?.search) params.set("search", opts.search);
      if (opts?.includeArchived) params.set("includeArchived", "true");
      const qs = params.toString();
      return fetchJson("GET", `/api/products${qs ? `?${qs}` : ""}`);
    },
    search: (q: string): Promise<Product[]> => fetchJson("GET", `/api/products/search?q=${encodeURIComponent(q)}`),
    getByBarcode: (b: string): Promise<Product | null> => fetchJson("GET", `/api/products/barcode/${encodeURIComponent(b)}`),
    create: (p: ProductInput): Promise<Product> => fetchJson("POST", "/api/products", p),
    update: (id: string, p: ProductInput): Promise<Product> => fetchJson("PUT", `/api/products/${id}`, p),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/products/${id}`),
    archive: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/products/${id}`),
    restore: (id: string): Promise<{ success: boolean }> => fetchJson("POST", `/api/products/${id}/restore`),
    listAll: (): Promise<Product[]> => fetchJson("GET", "/api/products?includeArchived=true"),
  },
  sales: {
    create: (s: SaleInput): Promise<Sale> => fetchJson("POST", "/api/sales", s),
    listRecent: (l = 10): Promise<Sale[]> => fetchJson("GET", `/api/sales/recent?limit=${l}`),
    getById: (id: string): Promise<Sale | null> => fetchJson("GET", `/api/sales/${id}`),
    search: (q: string): Promise<Sale[]> => fetchJson("GET", `/api/sales/search?q=${encodeURIComponent(q)}`),
    listByDate: (dateStr: string): Promise<Sale[]> => {
      const tzOffset = -new Date().getTimezoneOffset();
      return fetchJson("GET", `/api/sales/date/${dateStr}?tzOffset=${tzOffset}`);
    },
    listAll: (opts?: { search?: string; dateFrom?: string; dateTo?: string }): Promise<Sale[]> => {
      const params = new URLSearchParams();
      if (opts?.search) params.set("search", opts.search);
      if (opts?.dateFrom) params.set("dateFrom", opts.dateFrom);
      if (opts?.dateTo) params.set("dateTo", opts.dateTo);
      params.set("tzOffset", String(-new Date().getTimezoneOffset()));
      return fetchJson("GET", `/api/sales${params.toString() ? `?${params.toString()}` : ""}`);
    },
  },
  customers: {
    list: (): Promise<Customer[]> => fetchJson("GET", "/api/customers"),
    search: (q: string): Promise<Customer[]> => fetchJson("GET", `/api/customers/search?q=${encodeURIComponent(q)}`),
    create: (c: CustomerInput): Promise<Customer> => fetchJson("POST", "/api/customers", c),
    update: (id: string, c: CustomerInput): Promise<Customer> => fetchJson("PUT", `/api/customers/${id}`, c),
    delete: (id: string, opts?: { force?: boolean }): Promise<{ success: boolean }> =>
      fetchJson("DELETE", `/api/customers/${id}${opts?.force ? "?force=true" : ""}`),
    getById: (id: string): Promise<Customer | null> => fetchJson("GET", `/api/customers/${id}`),
  },
  arrears: {
    list: (status?: string): Promise<Arrear[]> => fetchJson("GET", `/api/arrears${status ? `?status=${status}` : ""}`),
    create: (a: ArrearInput): Promise<Arrear> => fetchJson("POST", "/api/arrears", a),
    recordPayment: (id: string, amount: number, password: string): Promise<{ arrear: Arrear; paymentSaleId: string }> =>
      fetchJson("POST", `/api/arrears/${id}/pay`, { amount, password }),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/arrears/${id}`),
    settle: (id: string, password: string): Promise<{ arrear: Arrear; paymentSaleId: string }> =>
      fetchJson("POST", `/api/arrears/${id}/settle`, { password }),
  },
  stock: {
    list: (): Promise<StockPurchase[]> => fetchJson("GET", "/api/stock"),
    create: (p: StockInput): Promise<StockPurchase> => fetchJson("POST", "/api/stock", p),
    update: (id: string, p: StockInput): Promise<StockPurchase> => fetchJson("PUT", `/api/stock/${id}`, p),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/stock/${id}`),
  },
  distributors: {
    list: (): Promise<Distributor[]> => fetchJson("GET", "/api/distributors"),
    create: (d: DistributorInput): Promise<Distributor> => fetchJson("POST", "/api/distributors", d),
    update: (id: string, d: DistributorInput): Promise<Distributor> => fetchJson("PUT", `/api/distributors/${id}`, d),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/distributors/${id}`),
  },
  companies: {
    list: (): Promise<Company[]> => fetchJson("GET", "/api/companies"),
    create: (c: CompanyInput): Promise<Company> => fetchJson("POST", "/api/companies", c),
    update: (id: string, c: CompanyInput): Promise<Company> => fetchJson("PUT", `/api/companies/${id}`, c),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/companies/${id}`),
  },
  returns: {
    list: (): Promise<ReturnEntry[]> => fetchJson("GET", "/api/returns"),
    getById: (id: string): Promise<ReturnEntry> => fetchJson("GET", `/api/returns/${id}`),
    create: (r: ReturnInput): Promise<ReturnEntry> => fetchJson("POST", "/api/returns", r),
  },
  expenses: {
    list: (): Promise<Expense[]> => fetchJson("GET", "/api/expenses"),
    create: (e: ExpenseInput): Promise<Expense> => fetchJson("POST", "/api/expenses", e),
    update: (id: string, e: ExpenseInput): Promise<Expense> => fetchJson("PUT", `/api/expenses/${id}`, e),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/expenses/${id}`),
  },
  categories: {
    list: (): Promise<Category[]> => fetchJson("GET", "/api/categories"),
    create: (c: CategoryInput): Promise<Category> => fetchJson("POST", "/api/categories", c),
    update: (id: string, c: CategoryInput): Promise<Category> => fetchJson("PUT", `/api/categories/${id}`, c),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/categories/${id}`),
  },
  dashboard: {
    stats: (): Promise<DashboardStats> => fetchJson("GET", "/api/dashboard/stats"),
  },
  settings: {
    backupCreate: (): Promise<BackupResult> => fetchJson("POST", "/api/settings/backup"),
    backupList: (): Promise<BackupEntry[]> => fetchJson("GET", "/api/settings/backups"),
    backupDelete: (name: string): Promise<{ success: boolean; error?: string }> =>
      fetchJson("DELETE", "/api/settings/backup", { name }),
    backupRestore: (name: string): Promise<{ success: boolean; error?: string }> =>
      fetchJson("POST", "/api/settings/backup/restore", { name }),
    getBackupDirectory: (): Promise<{ path: string }> => fetchJson("GET", "/api/settings/backup/directory"),
    gdriveGetConfig: (): Promise<GDriveConfig> => fetchJson("GET", "/api/settings/gdrive"),
    gdriveSaveConfig: (cfg: GDriveConfig): Promise<{ success: boolean }> =>
      fetchJson("PUT", "/api/settings/gdrive", cfg),
    aiGetConfig: (): Promise<AIConfig> => fetchJson("GET", "/api/settings/ai"),
    aiSaveConfig: (cfg: AIConfig): Promise<{ success: boolean }> =>
      fetchJson("PUT", "/api/settings/ai", cfg),
    aiTestConfig: (cfg: AIConfig): Promise<AITestResult> =>
      fetchJson("POST", "/api/settings/ai/test", cfg),
  },
  barcodes: {
    list: (): Promise<BarcodeEntry[]> => fetchJson("GET", "/api/barcodes"),
    create: (code: string): Promise<BarcodeEntry> => fetchJson("POST", "/api/barcodes", { code }),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/barcodes/${id}`),
  },
  ai: {
    inventory: {
      summary: (days = 30): Promise<AISummary> => fetchJson("GET", `/api/v1/ai/inventory/summary?days=${days}`),
      products: (riskLevel: RiskLevel, limit = 20, days = 30): Promise<unknown[]> =>
        fetchJson("GET", `/api/v1/ai/inventory/products?riskLevel=${riskLevel}&limit=${limit}&days=${days}`),
      productDetail: (id: string, days = 30): Promise<unknown> =>
        fetchJson("GET", `/api/v1/ai/inventory/products/${id}?days=${days}`),
      reorderCandidates: (days = 30): Promise<AIReorderCandidate[]> =>
        fetchJson("GET", `/api/v1/ai/inventory/reorder-candidates?days=${days}`),
      expiry: (): Promise<unknown> => fetchJson("GET", "/api/v1/ai/inventory/expiry"),
      dataQuality: (): Promise<unknown> => fetchJson("GET", "/api/v1/ai/inventory/data-quality"),
    },
    recommendations: {
      list: (status?: string, limit = 100): Promise<AIRecommendation[]> =>
        fetchJson("GET", `/api/v1/ai/inventory/recommendations${status ? `?status=${status}` : `?limit=${limit}`}`),
      summary: (): Promise<AIRecommendationSummary> =>
        fetchJson("GET", "/api/v1/ai/inventory/recommendations/summary"),
      run: (days = 30): Promise<{ created: number; at: string }> =>
        fetchJson("POST", "/api/v1/ai/inventory/recommendations/run", { days }),
      acknowledge: (id: string): Promise<unknown> =>
        fetchJson("PATCH", `/api/v1/ai/inventory/recommendations/${id}/acknowledge`),
      dismiss: (id: string): Promise<unknown> =>
        fetchJson("PATCH", `/api/v1/ai/inventory/recommendations/${id}/dismiss`),
    },
    chat: {
      send: (message: string, conversationId?: string): Promise<AIChatReply> =>
        fetchJson("POST", "/api/v1/ai/chat", { message, conversationId }),
      conversations: (limit = 50): Promise<AIConversation[]> =>
        fetchJson("GET", `/api/v1/ai/conversations?limit=${limit}`),
      conversation: (id: string): Promise<AIConversationDetail> =>
        fetchJson("GET", `/api/v1/ai/conversations/${id}`),
    },
    auditLogs: (limit = 100): Promise<AIAuditLog[]> =>
      fetchJson("GET", `/api/v1/ai/audit-logs?limit=${limit}`),
  },
  purchaseOrders: {
    list: (opts?: { status?: PurchaseOrderStatus | "all"; search?: string; from?: string; to?: string }): Promise<PurchaseOrder[]> => {
      const params = new URLSearchParams();
      if (opts?.status && opts.status !== "all") params.set("status", opts.status);
      if (opts?.search) params.set("search", opts.search);
      if (opts?.from) params.set("from", opts.from);
      if (opts?.to) params.set("to", opts.to);
      const qs = params.toString();
      return fetchJson("GET", `/api/v1/purchase-orders${qs ? `?${qs}` : ""}`);
    },
    getById: (id: string): Promise<PurchaseOrder> =>
      fetchJson("GET", `/api/v1/purchase-orders/${id}`),
    create: (draft: { distributorId: string; items: { productId: string; quantity: number }[]; notes?: string }): Promise<PurchaseOrder> =>
      fetchJson("POST", `/api/v1/purchase-orders`, draft),
    submit: (id: string): Promise<PurchaseOrder> =>
      fetchJson("POST", `/api/v1/purchase-orders/${id}/submit`),
    approve: (id: string): Promise<PurchaseOrder> =>
      fetchJson("POST", `/api/v1/purchase-orders/${id}/approve`),
    reject: (id: string, reason: string): Promise<PurchaseOrder> =>
      fetchJson("POST", `/api/v1/purchase-orders/${id}/reject`, { id, reason }),
  },
};

export { api };
