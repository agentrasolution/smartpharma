import type {
  Product, ProductInput, Customer, CustomerInput, Sale, SaleInput,
  Arrear, ArrearInput, StockPurchase, StockInput, Distributor, DistributorInput,
  Company, CompanyInput, ReturnEntry, ReturnInput, Expense, ExpenseInput,
  Category, CategoryInput, DashboardStats, BarcodeEntry, Paginated,
  AISummary, AIReorderCandidate, RiskLevel, AIRecommendation,
  AIRecommendationSummary, AIChatReply, AIConversation, AIConversationDetail,
  AIAuditLog, PurchaseOrder, PurchaseOrderStatus,
  PurchaseInvoice, CreatePurchaseInvoiceInput, DistributorPaymentRecord,
  RecordSupplierPaymentInput, DistributorLedger, SuppliersLedgerSummary,
  AIConfig, AITestResult,
  AuthUser, RegisterInput, Pharmacy, SubscriptionInfo,
  Permission, RoleListItem, RoleInput,
  UserListItem, UserInput, UpdateUserInput,
  Branch, BranchInput,
  Prescription, ControlledDrugRegister, SubstitutionSuggestionResult,
  ChronicMedication, ChronicMedicationInput, RefillQueueItem, CustomerStatement,
  StockTransfer, CreateTransferInput, BranchPriceOverride, BranchPriceOverrideInput, CrossBranchStockResponse,
  DrugMasterProduct, DrugMasterDetail, DrugMasterSearchParams, DrugMasterSearchResult,
  DrugMasterUpdateInput, BulkImportRow, BulkImportResult, ExpiryScanResult,
  PosShift, CashDrop, XReportData, ZReportData,
  MarginReport, LossReport, StockValuation, ProfitAndLoss,
  SupplierReturn, ReturnCandidate, CreateSupplierReturnInput, ApproveSupplierReturnInput,
} from "@/types";
import type { BackupResult, BackupEntry, GDriveConfig } from "@/types/electron";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function getApiUrl(): string {
  const cfg = window.appConfig?.serverUrl?.trim();
  if (cfg) return cfg;
  return process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001";
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
    if (res.status === 402) {
      window.dispatchEvent(new CustomEvent("subscription:blocked", { detail: { error: err.error } }));
    }
    throw new ApiError(err.error || `API error: ${res.status}`, res.status, err.code);
  }
  return res.json();
}

async function fetchText(path: string, auth = true): Promise<string> {
  const headers: Record<string, string> = {};
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiError(err.error || `API error: ${res.status}`, res.status);
  }
  return res.text();
}

const api = {
  auth: {
    register: (input: RegisterInput): Promise<{
      accessToken: string; refreshToken: string; csrfToken: string;
      user: AuthUser;
    }> =>
      fetchJson("POST", "/api/auth/register", input, false),
    login: (username: string, password: string): Promise<{
      accessToken: string; refreshToken: string; csrfToken: string;
      user: AuthUser;
    }> =>
      fetchJson("POST", "/api/auth/login", { username, password }, false),
    refresh: (refreshToken: string): Promise<{
      accessToken: string; refreshToken: string; csrfToken: string;
      user: AuthUser;
    }> =>
      fetchJson("POST", "/api/auth/refresh", { refreshToken }, false),
    me: (): Promise<AuthUser> => fetchJson("GET", "/api/auth/me"),
    logout: (accessToken: string): Promise<{ success: boolean }> =>
      fetchJson("POST", "/api/auth/logout", { accessToken }),
    changePassword: (currentPassword: string, newPassword: string): Promise<{
      accessToken: string; refreshToken: string; csrfToken: string;
      user: AuthUser;
    }> =>
      fetchJson("POST", "/api/auth/change-password", { currentPassword, newPassword }),
    verifyPassword: (password: string): Promise<{ valid: boolean }> =>
      fetchJson("POST", "/api/auth/verify-password", { password }),
    generateRecoveryKey: (): Promise<{ phrase: string }> =>
      fetchJson("POST", "/api/auth/generate-recovery-key"),
    recoverPassword: (phrase: string, newPassword: string, username: string): Promise<{ success: boolean; error?: string }> =>
      fetchJson("POST", "/api/auth/recover-password", { phrase, newPassword, username }, false),
    sendVerificationEmail: (email?: string): Promise<{ success: boolean; email: string; message: string }> =>
      fetchJson("POST", "/api/auth/send-verification-email", { email }),
    verifyEmail: (code: string): Promise<{ success: boolean; isEmailVerified: boolean; verifiedAt: string }> =>
      fetchJson("POST", "/api/auth/verify-email", { code }),
    forgotPassword: (identifier: string): Promise<{ success: boolean; maskedEmail: string; message: string }> =>
      fetchJson("POST", "/api/auth/forgot-password", { identifier }, false),
    resetPasswordOtp: (identifier: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> =>
      fetchJson("POST", "/api/auth/reset-password-otp", { identifier, code, newPassword }, false),
  },
  pharmacy: {
    get: (): Promise<Pharmacy> => fetchJson("GET", "/api/pharmacy"),
    update: (input: Partial<Pick<Pharmacy, "name" | "contact" | "phone" | "email" | "address" | "countryCode" | "countryName" | "city" | "currency" | "timezone" | "isPhoneVerified">>): Promise<Pharmacy> =>
      fetchJson("PATCH", "/api/pharmacy", input),
    updateOnboarding: (input: {
      pharmacyName: string;
      country: string;
      countryName?: string;
      city: string;
      phone?: string;
      currency?: string;
      branchName: string;
      branchAddress?: string;
      licenceNumber?: string;
    }): Promise<{ success: boolean }> =>
      fetchJson("POST", "/api/pharmacy/onboarding", input),
    adminList: (): Promise<Pharmacy[]> => fetchJson("GET", "/api/pharmacy/admin/pharmacies"),
    adminUpdateSubscription: (
      pharmacyId: string,
      input: Partial<SubscriptionInfo> & { extendMonths?: number },
    ): Promise<SubscriptionInfo> =>
      fetchJson("PATCH", `/api/pharmacy/admin/pharmacies/${pharmacyId}/subscription`, input),
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
    getStatement: (id: string): Promise<CustomerStatement> => fetchJson("GET", `/api/customers/${id}/statement`),
    refillQueue: (filter?: "all" | "dueSoon" | "dueToday" | "overdue"): Promise<RefillQueueItem[]> =>
      fetchJson("GET", `/api/customers/refills/queue${filter ? `?filter=${filter}` : ""}`),
    listChronic: (customerId: string): Promise<ChronicMedication[]> =>
      fetchJson("GET", `/api/customers/${customerId}/chronic-medications`),
    addChronic: (med: ChronicMedicationInput): Promise<ChronicMedication> =>
      fetchJson("POST", "/api/customers/chronic-medications", med),
    updateChronic: (medId: string, med: Partial<ChronicMedicationInput> & { status?: string }): Promise<ChronicMedication> =>
      fetchJson("PUT", `/api/customers/chronic-medications/${medId}`, med),
    deleteChronic: (medId: string): Promise<{ success: boolean }> =>
      fetchJson("DELETE", `/api/customers/chronic-medications/${medId}`),
    recordContact: (medId: string, notes: string): Promise<ChronicMedication> =>
      fetchJson("POST", `/api/customers/chronic-medications/${medId}/contact`, { notes }),
    recordRefill: (medId: string, data: { dispensedDate?: string; daysSupply?: number; notes?: string }): Promise<ChronicMedication> =>
      fetchJson("POST", `/api/customers/chronic-medications/${medId}/refill`, data),
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
  purchaseInvoices: {
    list: (opts?: { distributorId?: string; status?: string; dateFrom?: string; dateTo?: string; search?: string }): Promise<PurchaseInvoice[]> => {
      const params = new URLSearchParams();
      if (opts?.distributorId) params.set("distributorId", opts.distributorId);
      if (opts?.status) params.set("status", opts.status);
      if (opts?.dateFrom) params.set("dateFrom", opts.dateFrom);
      if (opts?.dateTo) params.set("dateTo", opts.dateTo);
      if (opts?.search) params.set("search", opts.search);
      const qs = params.toString();
      return fetchJson("GET", `/api/purchase-invoices${qs ? `?${qs}` : ""}`);
    },
    getById: (id: string): Promise<PurchaseInvoice> => fetchJson("GET", `/api/purchase-invoices/${id}`),
    create: (data: CreatePurchaseInvoiceInput): Promise<PurchaseInvoice> => fetchJson("POST", "/api/purchase-invoices", data),
    recordPayment: (distributorId: string, data: RecordSupplierPaymentInput): Promise<{ payment: DistributorPaymentRecord; invoice: PurchaseInvoice | null }> =>
      fetchJson("POST", `/api/distributors/${distributorId}/payments`, data),
  },
  distributors: {
    list: (): Promise<Distributor[]> => fetchJson("GET", "/api/distributors"),
    create: (d: DistributorInput): Promise<Distributor> => fetchJson("POST", "/api/distributors", d),
    update: (id: string, d: DistributorInput): Promise<Distributor> => fetchJson("PUT", `/api/distributors/${id}`, d),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/distributors/${id}`),
    getLedger: (id: string): Promise<DistributorLedger> => fetchJson("GET", `/api/distributors/${id}/ledger`),
    getSummary: (): Promise<SuppliersLedgerSummary> => fetchJson("GET", "/api/distributors/ledger/summary"),
    recordPayment: (id: string, data: RecordSupplierPaymentInput): Promise<{ payment: DistributorPaymentRecord; invoice: PurchaseInvoice | null }> =>
      fetchJson("POST", `/api/distributors/${id}/payments`, data),
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
  reports: {
    stats: (): Promise<DashboardStats> => fetchJson("GET", "/api/reports/stats"),
    margins: (params?: { startDate?: string; endDate?: string; branchId?: string; groupBy?: "drug" | "category" | "supplier" | "branch" }): Promise<MarginReport> => {
      const q = new URLSearchParams();
      if (params?.startDate) q.append("startDate", params.startDate);
      if (params?.endDate) q.append("endDate", params.endDate);
      if (params?.branchId) q.append("branchId", params.branchId);
      if (params?.groupBy) q.append("groupBy", params.groupBy);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return fetchJson("GET", `/api/reports/margins${queryStr}`);
    },
    losses: (params?: { startDate?: string; endDate?: string; branchId?: string }): Promise<LossReport> => {
      const q = new URLSearchParams();
      if (params?.startDate) q.append("startDate", params.startDate);
      if (params?.endDate) q.append("endDate", params.endDate);
      if (params?.branchId) q.append("branchId", params.branchId);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return fetchJson("GET", `/api/reports/losses${queryStr}`);
    },
    valuation: (branchId?: string): Promise<StockValuation> => {
      const queryStr = branchId ? `?branchId=${branchId}` : "";
      return fetchJson("GET", `/api/reports/valuation${queryStr}`);
    },
    profitAndLoss: (params?: { startDate?: string; endDate?: string; branchId?: string }): Promise<ProfitAndLoss> => {
      const q = new URLSearchParams();
      if (params?.startDate) q.append("startDate", params.startDate);
      if (params?.endDate) q.append("endDate", params.endDate);
      if (params?.branchId) q.append("branchId", params.branchId);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return fetchJson("GET", `/api/reports/profit-loss${queryStr}`);
    },
    exportCsv: async (params: { type: "sales_cogs" | "margin" | "valuation" | "pnl"; startDate?: string; endDate?: string; branchId?: string; groupBy?: string }): Promise<{ filename: string; csv: string }> => {
      const q = new URLSearchParams();
      q.append("type", params.type);
      q.append("format", "csv");
      if (params.startDate) q.append("startDate", params.startDate);
      if (params.endDate) q.append("endDate", params.endDate);
      if (params.branchId) q.append("branchId", params.branchId);
      if (params.groupBy) q.append("groupBy", params.groupBy);
      const text = await fetchText(`/api/reports/export?${q.toString()}`);
      return {
        filename: `${params.type}-report-${Date.now()}.csv`,
        csv: text,
      };
    },
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
  users: {
    list: (opts?: { search?: string; role?: string; status?: "active" | "inactive" | "all" }): Promise<UserListItem[]> => {
      const params = new URLSearchParams();
      if (opts?.search) params.set("search", opts.search);
      if (opts?.role) params.set("role", opts.role);
      if (opts?.status && opts.status !== "all") params.set("status", opts.status);
      const qs = params.toString();
      return fetchJson("GET", `/api/users${qs ? `?${qs}` : ""}`);
    },
    getById: (id: string): Promise<UserListItem> => fetchJson("GET", `/api/users/${id}`),
    create: (input: UserInput): Promise<{ user: UserListItem; temporaryPassword: string }> =>
      fetchJson("POST", "/api/users", input),
    update: (id: string, input: UpdateUserInput): Promise<UserListItem> =>
      fetchJson("PATCH", `/api/users/${id}`, input),
    updateStatus: (id: string, isActive: boolean): Promise<UserListItem> =>
      fetchJson("PATCH", `/api/users/${id}/status`, { isActive }),
    resetPassword: (id: string): Promise<{ user: UserListItem; temporaryPassword: string }> =>
      fetchJson("POST", `/api/users/${id}/reset-password`),
    remove: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/users/${id}`),
  },
  roles: {
    list: (): Promise<RoleListItem[]> => fetchJson("GET", "/api/roles"),
    getById: (id: string): Promise<RoleListItem> => fetchJson("GET", `/api/roles/${id}`),
    create: (input: RoleInput): Promise<RoleListItem> => fetchJson("POST", "/api/roles", input),
    update: (id: string, input: RoleInput): Promise<RoleListItem> =>
      fetchJson("PATCH", `/api/roles/${id}`, input),
    remove: (id: string): Promise<{ success: boolean }> => fetchJson("DELETE", `/api/roles/${id}`),
  },
  permissions: {
    list: (): Promise<Permission[]> => fetchJson("GET", "/api/permissions"),
  },
  branches: {
    list: (): Promise<Branch[]> => fetchJson("GET", "/api/branches"),
    getById: (id: string): Promise<Branch> => fetchJson("GET", `/api/branches/${id}`),
    create: (input: BranchInput): Promise<Branch> => fetchJson("POST", "/api/branches", input),
    update: (id: string, input: BranchInput): Promise<Branch> =>
      fetchJson("PATCH", `/api/branches/${id}`, input),
    remove: (id: string): Promise<{ success: boolean }> =>
      fetchJson("DELETE", `/api/branches/${id}`),
    getPriceOverrides: (branchId: string): Promise<{ branch: { id: string; name: string; allowPriceOverride: boolean }; overrides: BranchPriceOverride[] }> =>
      fetchJson("GET", `/api/branches/${branchId}/price-overrides`),
    setPriceOverride: (branchId: string, input: BranchPriceOverrideInput): Promise<BranchPriceOverride> =>
      fetchJson("POST", `/api/branches/${branchId}/price-overrides`, input),
    deletePriceOverride: (branchId: string, productId: string): Promise<{ success: boolean }> =>
      fetchJson("DELETE", `/api/branches/${branchId}/price-overrides/${productId}`),
    crossBranchStock: (params: { productId?: string; barcode?: string }): Promise<CrossBranchStockResponse> => {
      const qs = new URLSearchParams();
      if (params.productId) qs.set("productId", params.productId);
      if (params.barcode) qs.set("barcode", params.barcode);
      return fetchJson("GET", `/api/branches/cross-stock?${qs.toString()}`);
    },
    crossStock: (params: { productId?: string; barcode?: string }): Promise<CrossBranchStockResponse> =>
      api.branches.crossBranchStock(params),
  },
  transfers: {
    list: (params?: { branchId?: string; direction?: string; status?: string; search?: string; page?: number; pageSize?: number }): Promise<{ data: StockTransfer[]; total: number; page: number; pageSize: number }> => {
      const qs = new URLSearchParams();
      if (params?.branchId) qs.set("branchId", params.branchId);
      if (params?.direction) qs.set("direction", params.direction);
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      if (params?.page) qs.set("page", String(params.page));
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
      return fetchJson("GET", `/api/transfers?${qs.toString()}`);
    },
    getById: (id: string): Promise<StockTransfer> => fetchJson("GET", `/api/transfers/${id}`),
    create: (input: CreateTransferInput): Promise<StockTransfer> => fetchJson("POST", "/api/transfers", input),
    send: (id: string): Promise<StockTransfer> => fetchJson("POST", `/api/transfers/${id}/send`),
    receive: (id: string): Promise<StockTransfer> => fetchJson("POST", `/api/transfers/${id}/receive`),
    reject: (id: string, reason?: string): Promise<StockTransfer> =>
      fetchJson("POST", `/api/transfers/${id}/reject`, { reason }),
    cancel: (id: string): Promise<StockTransfer> => fetchJson("POST", `/api/transfers/${id}/cancel`),
    crossBranchStock: (params: { productId?: string; barcode?: string }): Promise<CrossBranchStockResponse> => {
      const qs = new URLSearchParams();
      if (params.productId) qs.set("productId", params.productId);
      if (params.barcode) qs.set("barcode", params.barcode);
      return fetchJson("GET", `/api/transfers/cross-stock?${qs.toString()}`);
    },
  },
  drugMaster: {
    search: (params?: DrugMasterSearchParams): Promise<DrugMasterSearchResult> => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.isRx !== undefined) qs.set("isRx", String(params.isRx));
      if (params?.isControlled !== undefined) qs.set("isControlled", String(params.isControlled));
      if (params?.dosageForm) qs.set("dosageForm", params.dosageForm);
      if (params?.category) qs.set("category", params.category);
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      const qStr = qs.toString();
      return fetchJson("GET", `/api/products/drug-master${qStr ? `?${qStr}` : ""}`);
    },
    getById: (id: string): Promise<DrugMasterDetail> =>
      fetchJson("GET", `/api/products/drug-master/${id}`),
    update: (id: string, input: DrugMasterUpdateInput): Promise<DrugMasterProduct> =>
      fetchJson("PATCH", `/api/products/drug-master/${id}`, input),
    bulkImport: (rows: BulkImportRow[]): Promise<BulkImportResult> =>
      fetchJson("POST", "/api/products/drug-master/bulk-import", rows),
    listIncomplete: (page = 1, limit = 50): Promise<DrugMasterSearchResult> =>
      fetchJson("GET", `/api/products/drug-master/incomplete?page=${page}&limit=${limit}`),
    listDosageForms: (): Promise<string[]> =>
      fetchJson("GET", "/api/products/drug-master/dosage-forms"),
    runExpiryScan: (days?: number): Promise<ExpiryScanResult> =>
      fetchJson("POST", `/api/products/drug-master/run-expiry-scan${days ? `?days=${days}` : ""}`),
  },
  inventory: {
    batches: {
      list: (params?: { status?: string; isRecalled?: boolean }): Promise<unknown[]> => {
        const qs = new URLSearchParams();
        if (params?.status) qs.set("status", params.status);
        if (params?.isRecalled !== undefined) qs.set("isRecalled", String(params.isRecalled));
        return fetchJson("GET", `/api/v1/inventory/batches${qs.toString() ? `?${qs}` : ""}`);
      },
      forProduct: (productId: string): Promise<unknown[]> =>
        fetchJson("GET", `/api/v1/inventory/batches/product/${productId}`),
      getById: (id: string): Promise<unknown> => fetchJson("GET", `/api/v1/inventory/batches/${id}`),
      receive: (data: {
        productId: string; batchNumber: string; expiryDate: string;
        quantityInBaseUnits: number; costPricePerUnit: number; salePricePerUnit: number; gtin?: string;
      }): Promise<unknown> => fetchJson("POST", "/api/v1/inventory/batches", data),
      adjust: (id: string, data: { deltaUnits: number; reasonCode: string; referenceNumber?: string }): Promise<unknown> =>
        fetchJson("PATCH", `/api/v1/inventory/batches/${id}/adjust`, data),
      recall: (id: string, reason: string): Promise<unknown> =>
        fetchJson("PATCH", `/api/v1/inventory/batches/${id}/recall`, { reason }),
      expiringSoon: (days?: number): Promise<unknown[]> =>
        fetchJson("GET", `/api/v1/inventory/batches/expiring-soon${days ? `?days=${days}` : ""}`),
    },
    movements: {
      list: (params?: { productId?: string; movementType?: string; from?: string; to?: string; page?: number; limit?: number; }): Promise<{ data: unknown[]; meta: { total: number; page: number; pages: number } }> => {
        const qs = new URLSearchParams();
        if (params?.productId) qs.set("productId", params.productId);
        if (params?.movementType) qs.set("movementType", params.movementType);
        if (params?.from) qs.set("from", params.from);
        if (params?.to) qs.set("to", params.to);
        if (params?.page) qs.set("page", String(params.page));
        return fetchJson("GET", `/api/v1/inventory/movements${qs.toString() ? `?${qs}` : ""}`);
      },
      summary: (from: string, to: string): Promise<unknown[]> =>
        fetchJson("GET", `/api/v1/inventory/movements/summary?from=${from}&to=${to}`),
    },
    valuation: (): Promise<unknown[]> => fetchJson("GET", "/api/v1/inventory/valuation"),
    expiringScan: (days?: number): Promise<{ expiredMarked: number; depletedMarked: number; nearExpiryAlerts: number }> =>
      fetchJson("POST", `/api/products/drug-master/run-expiry-scan${days ? `?days=${days}` : ""}`),
  },
  prescriptions: {
    list: (params?: { status?: string; search?: string; patientIdentifier?: string; dateFrom?: string; dateTo?: string }): Promise<Prescription[]> => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      if (params?.patientIdentifier) qs.set("patientIdentifier", params.patientIdentifier);
      if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
      if (params?.dateTo) qs.set("dateTo", params.dateTo);
      return fetchJson("GET", `/api/v1/prescriptions${qs.toString() ? `?${qs}` : ""}`);
    },
    getById: (id: string): Promise<Prescription> =>
      fetchJson("GET", `/api/v1/prescriptions/${id}`),
    create: (data: {
      prescriptionNumber?: string;
      patientName: string;
      patientIdentifier?: string;
      patientPhone?: string;
      patientAge?: number | null;
      patientGender?: string | null;
      doctorName: string;
      doctorLicense?: string;
      clinicOrHospital?: string;
      diagnosis?: string;
      prescribedDate?: string;
      notes?: string;
      items: Array<{
        prescribedDrugName: string;
        productId?: string | null;
        dosage?: string;
        frequency?: string;
        duration?: string;
        instructions?: string;
        quantityPrescribed: number;
        isControlled?: boolean;
      }>;
    }): Promise<Prescription> => fetchJson("POST", "/api/v1/prescriptions", data),
    verify: (id: string, data: { verified: boolean; notes?: string }): Promise<Prescription> =>
      fetchJson("POST", `/api/v1/prescriptions/${id}/verify`, data),
    dispense: (id: string, data: {
      items: Array<{
        prescriptionItemId: string;
        dispensedProductId: string;
        batchId?: string | null;
        quantity: number;
        isSubstitution?: boolean;
        substitutionReason?: string | null;
        notes?: string;
        witnessName?: string | null;
      }>;
      notes?: string;
    }): Promise<Prescription> => fetchJson("POST", `/api/v1/prescriptions/${id}/dispense`, data),
    suggestSubstitutions: (productId: string): Promise<SubstitutionSuggestionResult> =>
      fetchJson("GET", `/api/v1/prescriptions/substitutions/suggest?productId=${productId}`),
    controlledRegister: (params?: { productId?: string; search?: string; dateFrom?: string; dateTo?: string }): Promise<ControlledDrugRegister[]> => {
      const qs = new URLSearchParams();
      if (params?.productId) qs.set("productId", params.productId);
      if (params?.search) qs.set("search", params.search);
      if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
      if (params?.dateTo) qs.set("dateTo", params.dateTo);
      return fetchJson("GET", `/api/v1/prescriptions/controlled-register${qs.toString() ? `?${qs}` : ""}`);
    },
  },
  shifts: {
    getActive: (): Promise<PosShift | null> => fetchJson("GET", "/api/shifts/active"),
    open: (data: { openingCash: number; notes?: string }): Promise<PosShift> =>
      fetchJson("POST", "/api/shifts/open", data),
    drop: (data: { shiftId: string; type: "DROP" | "PAYOUT" | "FLOAT_ADD"; amount: number; reason: string }): Promise<CashDrop> =>
      fetchJson("POST", "/api/shifts/drop", data),
    getXReport: (shiftId: string): Promise<XReportData> =>
      fetchJson("GET", `/api/shifts/${shiftId}/x-report`),
    close: (data: { shiftId: string; actualCash: number; closingNotes?: string }): Promise<ZReportData> =>
      fetchJson("POST", `/api/shifts/${data.shiftId}/close`, data),
    list: (params?: { page?: number; pageSize?: number; status?: string; cashierId?: string; from?: string; to?: string }): Promise<{ data: PosShift[]; total: number; page: number; pageSize: number; totalPages: number }> => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params?.status) qs.set("status", params.status);
      if (params?.cashierId) qs.set("cashierId", params.cashierId);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      return fetchJson("GET", `/api/shifts${qs.toString() ? `?${qs}` : ""}`);
    },
    getById: (shiftId: string): Promise<PosShift> =>
      fetchJson("GET", `/api/shifts/${shiftId}`),
  },
  supplierReturns: {
    list: (params?: { page?: number; pageSize?: number; status?: string; distributorId?: string; branchId?: string; reason?: string; search?: string; from?: string; to?: string }): Promise<{ data: SupplierReturn[]; total: number; page: number; pageSize: number; totalPages: number }> => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params?.status) qs.set("status", params.status);
      if (params?.distributorId) qs.set("distributorId", params.distributorId);
      if (params?.branchId) qs.set("branchId", params.branchId);
      if (params?.reason) qs.set("reason", params.reason);
      if (params?.search) qs.set("search", params.search);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      return fetchJson("GET", `/api/supplier-returns${qs.toString() ? `?${qs}` : ""}`);
    },
    getCandidates: (distributorId?: string, days = 90): Promise<ReturnCandidate[]> => {
      const qs = new URLSearchParams();
      if (distributorId) qs.set("distributorId", distributorId);
      if (days) qs.set("days", String(days));
      return fetchJson("GET", `/api/supplier-returns/candidates${qs.toString() ? `?${qs}` : ""}`);
    },
    getById: (id: string): Promise<SupplierReturn> =>
      fetchJson("GET", `/api/supplier-returns/${id}`),
    create: (data: CreateSupplierReturnInput): Promise<SupplierReturn> =>
      fetchJson("POST", "/api/supplier-returns", data),
    approve: (id: string, data?: ApproveSupplierReturnInput): Promise<SupplierReturn> =>
      fetchJson("POST", `/api/supplier-returns/${id}/approve`, data || {}),
    reject: (id: string, reason: string): Promise<SupplierReturn> =>
      fetchJson("POST", `/api/supplier-returns/${id}/reject`, { reason }),
  },
};
export { api };
