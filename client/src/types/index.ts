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
  distributorId?: string;
  salePrice?: number;
  purchasePrice: number;
  markupPercent?: number;
  category?: string;
  location?: string;
  expiry?: string;
  packSize?: number;
  prices?: ProductPriceInput[];
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
