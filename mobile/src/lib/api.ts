import type {
  Arrear,
  ArrearInput,
  AuthUser,
  Company,
  Customer,
  CustomerInput,
  DashboardStats,
  Distributor,
  Expense,
  LoginResponse,
  Paginated,
  Pharmacy,
  Product,
  ProductInput,
  RegisterInput,
  ReturnEntry,
  Sale,
  SaleInput,
  StockPurchase,
} from '@/types';
import { runtime } from '@/lib/runtime';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type UnauthorizedHandler = () => void;
export type SubscriptionBlockedHandler = () => void;

let tokenGetter: () => string | null = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};
let onSubscriptionBlocked: SubscriptionBlockedHandler = () => {};

export function configureApi(options: {
  getToken: () => string | null;
  onUnauthorized: UnauthorizedHandler;
  onSubscriptionBlocked?: SubscriptionBlockedHandler;
}) {
  tokenGetter = options.getToken;
  onUnauthorized = options.onUnauthorized;
  onSubscriptionBlocked = options.onSubscriptionBlocked ?? (() => {});
}

export async function fetchJson<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = tokenGetter();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${runtime.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach server. Check server URL in Settings.');
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: `Network error: ${res.status}` }))) as {
      error?: string;
      code?: string;
    };
    if (res.status === 401 && auth) {
      onUnauthorized();
    }
    if (res.status === 402 && auth) {
      onSubscriptionBlocked();
    }
    throw new ApiError(err.error || `HTTP ${res.status}`, res.status, err.code);
  }
  return res.json();
}

const api = {
  auth: {
    register: (input: RegisterInput): Promise<LoginResponse> =>
      fetchJson('POST', '/api/auth/register', input, false),
    login: (username: string, password: string): Promise<LoginResponse> =>
      fetchJson('POST', '/api/auth/login', { username, password }, false),
    refresh: (refreshToken: string): Promise<LoginResponse> =>
      fetchJson('POST', '/api/auth/refresh', { refreshToken }, false),
    logout: (accessToken: string): Promise<{ success: boolean }> =>
      fetchJson('POST', '/api/auth/logout', { accessToken }),
    me: (): Promise<AuthUser> => fetchJson('GET', '/api/auth/me'),
  },
  pharmacy: {
    get: (): Promise<Pharmacy> => fetchJson('GET', '/api/pharmacy'),
  },
  dashboard: {
    stats: (): Promise<DashboardStats> => fetchJson('GET', '/api/dashboard/stats'),
  },
  products: {
    list: (opts?: { page?: number; pageSize?: number; search?: string }): Promise<Paginated<Product>> => {
      const params = new URLSearchParams();
      if (opts?.page) params.set('page', String(opts.page));
      if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
      if (opts?.search) params.set('search', opts.search);
      const qs = params.toString();
      return fetchJson('GET', `/api/products${qs ? `?${qs}` : ''}`);
    },
    search: (q: string): Promise<Product[]> =>
      fetchJson('GET', `/api/products/search?q=${encodeURIComponent(q)}`),
    getByBarcode: (b: string): Promise<Product | null> =>
      fetchJson('GET', `/api/products/barcode/${encodeURIComponent(b)}`),
    getById: (id: string): Promise<Product | null> => fetchJson('GET', `/api/products/${id}`),
    create: (p: ProductInput): Promise<Product> => fetchJson('POST', '/api/products', p),
    update: (id: string, p: ProductInput): Promise<Product> =>
      fetchJson('PUT', `/api/products/${id}`, p),
  },
  sales: {
    create: (s: SaleInput): Promise<Sale> => fetchJson('POST', '/api/sales', s),
    listRecent: (l = 10): Promise<Sale[]> => fetchJson('GET', `/api/sales/recent?limit=${l}`),
    getById: (id: string): Promise<Sale | null> => fetchJson('GET', `/api/sales/${id}`),
    search: (q: string): Promise<Sale[]> =>
      fetchJson('GET', `/api/sales/search?q=${encodeURIComponent(q)}`),
    listAll: (opts?: { search?: string; dateFrom?: string; dateTo?: string }): Promise<Sale[]> => {
      const params = new URLSearchParams();
      if (opts?.search) params.set('search', opts.search);
      if (opts?.dateFrom) params.set('dateFrom', opts.dateFrom);
      if (opts?.dateTo) params.set('dateTo', opts.dateTo);
      params.set('tzOffset', String(-new Date().getTimezoneOffset()));
      return fetchJson('GET', `/api/sales${params.toString() ? `?${params.toString()}` : ''}`);
    },
  },
  customers: {
    list: (): Promise<Customer[]> => fetchJson('GET', '/api/customers'),
    search: (q: string): Promise<Customer[]> =>
      fetchJson('GET', `/api/customers/search?q=${encodeURIComponent(q)}`),
    getById: (id: string): Promise<Customer | null> => fetchJson('GET', `/api/customers/${id}`),
    create: (c: CustomerInput): Promise<Customer> => fetchJson('POST', '/api/customers', c),
    update: (id: string, c: CustomerInput): Promise<Customer> =>
      fetchJson('PUT', `/api/customers/${id}`, c),
  },
  arrears: {
    list: (status?: string): Promise<Arrear[]> =>
      fetchJson('GET', `/api/arrears${status ? `?status=${status}` : ''}`),
    create: (a: ArrearInput): Promise<Arrear> => fetchJson('POST', '/api/arrears', a),
    recordPayment: (id: string, amount: number, password: string): Promise<{ arrear: Arrear; paymentSaleId: string }> =>
      fetchJson('POST', `/api/arrears/${id}/pay`, { amount, password }),
    delete: (id: string): Promise<{ success: boolean }> => fetchJson('DELETE', `/api/arrears/${id}`),
    settle: (id: string, password: string): Promise<{ arrear: Arrear; paymentSaleId: string }> =>
      fetchJson('POST', `/api/arrears/${id}/settle`, { password }),
  },
  stock: {
    list: (): Promise<StockPurchase[]> => fetchJson('GET', '/api/stock'),
    create: (p: {
      productId: string;
      distributorId?: string;
      invoiceNumber?: string;
      purchasePrice?: number;
      salePrice?: number;
      quantity: number;
      expiry?: string;
    }): Promise<StockPurchase> => fetchJson('POST', '/api/stock', p),
  },
  distributors: {
    list: (): Promise<Distributor[]> => fetchJson('GET', '/api/distributors'),
  },
  companies: {
    list: (): Promise<Company[]> => fetchJson('GET', '/api/companies'),
  },
  returns: {
    list: (): Promise<ReturnEntry[]> => fetchJson('GET', '/api/returns'),
    getById: (id: string): Promise<ReturnEntry> => fetchJson('GET', `/api/returns/${id}`),
  },
  expenses: {
    list: (): Promise<Expense[]> => fetchJson('GET', '/api/expenses'),
  },
};

export { api };