export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface CategoryInput {
  name: string;
}

export interface ProductPrice {
  id: string;
  productId: string;
  label: string;
  purchasePrice: number;
  salePrice: number;
}

export interface ProductPriceInput {
  label?: string;
  purchasePrice: number;
  salePrice?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
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

export interface ProductInput {
  barcode: string;
  name: string;
  company?: string;
  distributorId?: string;
  salePrice?: number;
  purchasePrice: number;
  markupPercent?: number;
  category?: string;
  location?: string;
  expiry?: string;
  packSize?: number;
  prices?: ProductPriceInput[];
  branchId?: string;
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

export interface SaleInput {
  customerId?: string;
  customerName?: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  items: SaleItemInput[];
}

export interface SaleItemInput {
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
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
  totalBill: number;
  amountPaid?: number;
  saleId?: string;
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

export interface StockInput {
  productId: string;
  distributorId?: string;
  companyId?: string;
  invoiceNumber?: string;
  purchasePrice?: number;
  salePrice?: number;
  quantity: number;
  expiry?: string;
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

export interface DistributorInput {
  name: string;
  phone: string;
  companyId?: string;
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

export interface CompanyInput {
  name: string;
  phone: string;
  address?: string;
  second_number?: string;
}

export interface ReturnEntry {
  id: string;
  sale_id: string;
  customer_name?: string;
  refund_amount: number;
  reason: string;
  created_at: string;
  items?: Array<{
    product_name: string;
    quantity: number;
    refund_amount: number;
  }>;
}

export interface ReturnItemInput {
  productId: string;
  productName: string;
  quantity: number;
  refundAmount: number;
}

export interface ReturnInput {
  saleId: string;
  refundAmount: number;
  reason: string;
  items: ReturnItemInput[];
}

export interface ReturnResult extends Omit<ReturnEntry, "reason"> {
  items?: ReturnItemInput[];
  reason?: string;
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

export interface ExpenseInput {
  title: string;
  category: string;
  amount: number;
  notes?: string;
  date: string;
}

export type DiscountType = "pkr" | "percent";

export interface PrintMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PrinterConfig {
  paperSize: "thermal" | "a4" | "a5";
  deviceName: string | null;
  margins?: PrintMargins;
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

export interface BarcodeEntry {
  id: string;
  code: string;
  productId: string | null;
  product: { name: string; active: number } | null;
  createdAt: string;
}

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "HEALTHY" | "OVERSTOCK";

export interface AISummary {
  totalProducts: number;
  critical: number;
  high: number;
  medium: number;
  healthy: number;
  overstock: number;
}

export interface AIReorderCandidate {
  productId: string;
  name: string;
  barcode: string;
  currentStock: number;
  averageDailySales: number;
  stockCoverageDays: number | null;
  estimatedStockoutDays: number | null;
  leadTimeDays: number | null;
  reorderPoint: number;
  recommendedQuantity: number;
  recommendedQuantityPacked: number;
  riskLevel: RiskLevel;
  distributor: { id: string; name: string; leadTimeDays: number } | null;
}

export type RecommendationStatus =
  | "NEW"
  | "ACTIVE"
  | "ACKNOWLEDGED"
  | "DISMISSED"
  | "EXPIRED";

export interface AIRecommendation {
  id: string;
  productId: string;
  distributorId: string | null;
  riskLevel: RiskLevel;
  currentStock: number;
  averageDailySales: number;
  stockCoverageDays: number | null;
  estimatedStockoutDays: number | null;
  leadTimeDays: number | null;
  reorderPoint: number;
  recommendedQuantity: number;
  reason: string;
  status: RecommendationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  product: { id: string; name: string; barcode: string; category: string };
}

export type AIRecommendationSummary = Record<RecommendationStatus, number>;

export interface AIToolCall {
  toolName: string;
  arguments?: unknown;
}

export interface AIChatReply {
  reply: string;
  conversationId: string;
  toolCalls: AIToolCall[];
}

export interface AIConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface AIConversationMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  createdAt: string;
}

export interface AIConversationDetail extends AIConversation {
  messages: AIConversationMessage[];
}

export interface AIAuditLog {
  id: string;
  agentName: string;
  conversationId: string | null;
  toolName: string | null;
  action: string;
  status: string;
  approvalRequired: boolean;
  approvalStatus: string | null;
  approvedBy: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  product: { id: string; name: string; barcode: string };
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  distributorId: string;
  status: PurchaseOrderStatus;
  subtotal: number;
  total: number;
  notes: string;
  createdBy: string;
  idempotencyKey: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  distributor: { id: string; name: string } | null;
  items: PurchaseOrderItem[];
  aiGenerated?: boolean;
}

export interface AIConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AITestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
  model?: string;
  provider?: string;
}

export type JobRole =
  | "admin"
  | "manager"
  | "stock_manager"
  | "salesman"
  | "cashier"
  | "helper";

export const JOB_ROLES: JobRole[] = [
  "admin",
  "manager",
  "stock_manager",
  "salesman",
  "cashier",
  "helper",
];

export const JOB_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  stock_manager: "Stock Manager",
  salesman: "Salesman",
  cashier: "Cashier",
  helper: "Helper",
};

export interface BranchUserMember {
  id: string;
  username: string;
  name: string;
  jobRole: string;
  isActive: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  adminCount: number;
  managerCount: number;
  stockManagerCount: number;
  salesmanCount: number;
  cashierCount: number;
  helperCount: number;
  otherCount: number;
  users: BranchUserMember[];
}

export interface BranchInput {
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

export interface Permission {
  id: string;
  name: string;
  description?: string | null;
}

export interface PermissionInput {
  name: string;
  description?: string;
}

export interface RoleRef {
  id: string;
  name: string;
}

export interface UserRef {
  id: string;
  username: string;
}

export interface UserListItem {
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
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserInput {
  username: string;
  name: string;
  phone?: string;
  email?: string;
  roleId: string;
  branchId?: string | null;
  jobRole?: JobRole | "";
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  email?: string;
  roleId?: string;
  branchId?: string | null;
  jobRole?: JobRole | "";
  isActive?: boolean;
}

export interface RoleListItem {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleInput {
  name: string;
  description?: string;
  permissionNames: string[];
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
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

export interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: AuthUser;
}

export interface CreateUserResult {
  user: UserListItem;
  temporaryPassword: string;
}
