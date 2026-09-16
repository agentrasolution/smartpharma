export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  company: string;
  category: string;
  location: string;
  pharmacy_id?: string;
  branch_id?: string;
  distributor_id?: string;
  sale_price: number;
  purchase_price: number;
  markup_percent: number;
  stock_qty: number;
  pack_size: number;
  expiry?: string;
  active: number;
  created_at: string;
  prices?: ProductPrice[];
}

export interface ProductPrice {
  id: string;
  productId: string;
  label: string;
  purchasePrice: number;
  salePrice: number;
}

export interface ProductInput {
  barcode: string;
  name: string;
  distributorId?: string;
  salePrice?: number;
  purchasePrice: number;
  markupPercent?: number;
  category?: string;
  location?: string;
  expiry?: string;
  packSize?: number;
  prices?: { label?: string; purchasePrice: number; salePrice?: number }[];
  branchId?: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  father_name?: string;
  father_phone?: string;
  created_at: string;
  total_purchases?: number;
  outstanding_arrear?: number;
  last_purchase?: string;
  purchases?: Sale[];
  arrears?: Arrear[];
}

export interface CustomerInput {
  name: string;
  phone?: string;
  address?: string;
  fatherName?: string;
  fatherPhone?: string;
}

export interface Sale {
  id: string;
  customer_id?: string;
  customer_name?: string;
  subtotal: number;
  discount: number;
  total: number;
  amount_paid: number;
  change: number;
  status: string;
  created_at: string;
  return_count?: number;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  barcode: string;
  quantity: number;
  returned_qty?: number;
  unit_price: number;
  subtotal: number;
}

export interface SaleItemInput {
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleInput {
  customerId?: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  items: SaleItemInput[];
}

export interface Arrear {
  id: string;
  sale_id: string;
  customer_id: string;
  customer_name?: string;
  total_bill: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  created_at: string;
  payments?: ArrearPayment[];
}

export interface ArrearPayment {
  id: string;
  amount: number;
  payment_sale_id: string | null;
  created_at: string;
}

export interface ArrearInput {
  customerId: string;
  saleId: string;
  totalBill: number;
  amountPaid: number;
}

export interface StockPurchase {
  id: string;
  product_id: string;
  product_name?: string;
  distributor_id?: string;
  distributor_name?: string;
  company_id?: string;
  company_name?: string;
  invoice_number: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
  expiry?: string;
  total_value: number;
  active?: number;
  created_at: string;
}

export interface Distributor {
  id: string;
  name: string;
  phone: string;
  company_id?: string;
  company_name?: string;
  created_at: string;
  product_count?: number;
}

export interface Company {
  id: string;
  name: string;
  phone: string;
  address: string;
  second_number: string;
  created_at: string;
  product_count?: number;
}

export interface DashboardStats {
  todayRevenue: number;
  totalArrears: number;
  lowStockCount: number;
  expiringSoonCount: number;
  weekRevenue: { day: string; revenue: number }[];
  monthRevenue: { day: string; revenue: number }[];
  topProducts: { name: string; value: number }[];
}

export interface ReturnEntry {
  id: string;
  sale_id: string;
  customer_name?: string;
  refund_amount: number;
  reason: string;
  created_at: string;
  items?: Array<{ product_name: string; quantity: number; refund_amount: number }>;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  notes: string;
  date: string;
  created_at: string;
}

export type DiscountType = 'pkr' | 'percent';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  roleId: string | null;
  roleName: string | null;
  branchId: string | null;
  branchName: string | null;
  jobRole: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacySlug: string;
  subscription: SubscriptionInfo | null;
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionInfo {
  status: string;
  plan: string;
  price: number;
  startedAt?: string;
  renewsAt: string | null;
  cancelledAt?: string | null;
}

export interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  counts?: {
    branches: number;
    users: number;
    products: number;
    roles?: number;
  };
  subscription: SubscriptionInfo | null;
}

export interface RegisterInput {
  pharmacyName: string;
  branchName?: string;
  name: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
  contact?: string;
  address?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: AuthUser;
}