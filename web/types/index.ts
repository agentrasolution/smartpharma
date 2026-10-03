export interface Category {
  id: string;
  name: string;
  vatRate?: number;
  created_at: string;
}

export interface CategoryInput {
  name: string;
  vatRate?: number;
}

export interface ProductPrice {
  id: string;
  productId: string;
  label: string;
  purchasePrice: number;
  salePrice: number;
  unitType?: string;
  conversionRatio?: number;
}

export interface ProductPriceInput {
  label?: string;
  purchasePrice: number;
  salePrice?: number;
  unitType?: string;
  conversionRatio?: number;
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
  baseUnit?: string;
  packageUnit?: string;
  unitsPerPack?: number;
  stripsPerPack?: number;
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
  baseUnit?: string;
  packageUnit?: string;
  unitsPerPack?: number;
  stripsPerPack?: number;
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
  national_id?: string;
  date_of_birth?: string | null;
  gender?: string;
  blood_group?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  credit_limit?: number;
  allow_credit?: boolean;
  notes?: string;
  consent_given?: boolean;
  consent_date?: string | null;
  consent_notes?: string;
  created_at: string;
  updated_at?: string;
  total_purchases?: number;
  outstanding_arrear?: number;
  last_purchase?: string | null;
  active_chronic_meds?: number;
  purchases?: Sale[];
  arrears?: Arrear[];
  chronic_medications?: ChronicMedication[];
}

export interface CustomerInput {
  name: string;
  phone?: string;
  address?: string;
  fatherName?: string;
  fatherPhone?: string;
  nationalId?: string;
  dateOfBirth?: string | null;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  creditLimit?: number;
  allowCredit?: boolean;
  notes?: string;
  consentGiven?: boolean;
  consentDate?: string | null;
  consentNotes?: string;
}

export interface ChronicMedication {
  id: string;
  customer_id: string;
  product_id?: string | null;
  product_name?: string | null;
  medication_name: string;
  dosage: string;
  frequency: string;
  days_supply: number;
  last_dispensed_date: string;
  next_refill_date: string;
  days_remaining?: number;
  reminder_active: boolean;
  status: "ACTIVE" | "PAUSED" | "DISCONTINUED";
  notes?: string;
  last_contacted_at?: string | null;
  contact_notes?: string;
  created_at: string;
}

export interface ChronicMedicationInput {
  customerId: string;
  productId?: string | null;
  medicationName: string;
  dosage?: string;
  frequency?: string;
  daysSupply?: number;
  lastDispensedDate?: string;
  nextRefillDate?: string;
  reminderActive?: boolean;
  notes?: string;
}

export interface RefillQueueItem {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_national_id?: string;
  product_id?: string | null;
  product_name?: string | null;
  product_stock: number;
  product_sale_price: number;
  medication_name: string;
  dosage: string;
  frequency: string;
  days_supply: number;
  last_dispensed_date: string;
  next_refill_date: string;
  days_remaining: number;
  urgency: "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "UPCOMING";
  notes?: string;
  last_contacted_at?: string | null;
  contact_notes?: string;
}

export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
    national_id?: string;
    credit_limit?: number;
    allow_credit?: boolean;
  };
  summary: {
    total_billed: number;
    total_paid: number;
    current_balance: number;
  };
  entries: {
    date: string;
    reference: string;
    description: string;
    type: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }[];
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
  payment_method?: "CASH" | "CARD" | "SPLIT" | "CREDIT";
  cash_amount?: number;
  card_amount?: number;
  credit_amount?: number;
  prescription_id?: string | null;
  prescription_number?: string | null;
  cashier_id?: string | null;
  cashier_name?: string | null;
  notes?: string;
  created_at: string;
  totalCogs?: number;
  totalVat?: number;
  grossProfit?: number;
  total_cogs?: number;
  total_vat?: number;
  gross_profit?: number;
  return_count?: number;
  item_count?: number;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  barcode: string;
  quantity: number;
  packagingUnit?: string;
  packaging_unit?: string;
  conversionRatio?: number;
  conversion_ratio?: number;
  quantityBaseUnits?: number;
  quantity_base_units?: number;
  returned_qty?: number;
  unit_price: number;
  subtotal: number;
  unitCost?: number;
  unit_cost?: number;
  cogs?: number;
  vatRate?: number;
  vat_rate?: number;
  vatAmount?: number;
  vat_amount?: number;
  batch_id?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
}

export interface SaleInput {
  customerId?: string;
  customerName?: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  paymentMethod?: "CASH" | "CARD" | "SPLIT" | "CREDIT";
  cashAmount?: number;
  cardAmount?: number;
  creditAmount?: number;
  prescriptionId?: string | null;
  prescriptionNumber?: string | null;
  cashierId?: string | null;
  cashierName?: string | null;
  notes?: string;
  items: SaleItemInput[];
}

export interface SaleItemInput {
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  packagingUnit?: string;
  conversionRatio?: number;
  quantityBaseUnits?: number;
  unitPrice: number;
  subtotal: number;
  batchId?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
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

export interface PurchaseInvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productName?: string;
  productBarcode?: string;
  batchId?: string | null;
  batchNumber: string;
  expiryDate: string;
  quantityPacks: number;
  unitsPerPack: number;
  quantityBaseUnits: number;
  unitCost: number;
  salePrice: number;
  totalCost: number;
}

export interface PurchaseInvoiceItemInput {
  productId: string;
  batchNumber: string;
  expiryDate: string;
  quantityPacks: number;
  unitsPerPack?: number;
  unitCost: number;
  salePrice: number;
}

export interface PurchaseInvoice {
  id: string;
  pharmacyId: string;
  branchId: string;
  distributorId: string;
  distributorName?: string;
  distributorPhone?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "VOID";
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT" | string;
  notes: string;
  receivedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseInvoiceItem[];
  payments: DistributorPaymentRecord[];
  distributor?: {
    id: string;
    name: string;
    phone: string;
    contact?: string;
  };
}

export interface CreatePurchaseInvoiceInput {
  distributorId: string;
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string | null;
  discount?: number;
  tax?: number;
  paidAmount?: number;
  paymentMethod?: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT";
  notes?: string;
  items: PurchaseInvoiceItemInput[];
}

export interface DistributorPaymentRecord {
  id: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  paidAt: string;
  notes: string;
  invoiceNumber?: string | null;
}

export interface RecordSupplierPaymentInput {
  amount: number;
  invoiceId?: string | null;
  paymentMethod?: "CASH" | "BANK_TRANSFER" | "CHEQUE";
  referenceNumber?: string;
  paidAt?: string;
  notes?: string;
}

export interface LedgerTimelineEntry {
  id: string;
  date: string;
  type: "INVOICE" | "PAYMENT";
  refNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  status?: string;
  paymentMethod?: string;
}

export interface DistributorLedger {
  distributor: {
    id: string;
    name: string;
    phone: string;
    contact?: string;
    address?: string;
    companyName?: string | null;
  };
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
    totalInvoicesCount: number;
    unpaidInvoicesCount: number;
  };
  statement: LedgerTimelineEntry[];
  invoices: PurchaseInvoice[];
  payments: DistributorPaymentRecord[];
}

export interface SuppliersLedgerSummary {
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
    supplierCount: number;
    suppliersWithBalance: number;
  };
  distributors: Array<{
    id: string;
    name: string;
    phone: string;
    contact?: string;
    companyName?: string | null;
    invoiceCount: number;
    unpaidInvoices: number;
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
  }>;
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

export interface ReturnResult extends Omit<ReturnEntry, "reason" | "items"> {
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
  todayCogs?: number;
  todayProfit?: number;
  todaySalesCount?: number;
  monthRevenue?: number;
  monthCogs?: number;
  monthProfit?: number;
  monthGrossMarginPercent?: number;
  totalArrears: number;
  lowStockCount: number;
  expiringSoonCount: number;
  weekRevenue: { day: string; revenue: number }[];
  monthRevenueList?: { day: string; revenue: number }[];
  topProducts: { name: string; value: number; revenue?: number; cogs?: number; profit?: number }[];
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
  allowPriceOverride?: boolean;
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
  allowPriceOverride?: boolean;
}

export interface BranchPriceOverride {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  catalogPrice: number;
  overridePrice: number;
  reason?: string;
  effectiveDate: string;
  updatedAt?: string;
}

export interface BranchPriceOverrideInput {
  productId: string;
  salePrice: number;
  reason?: string;
}

export interface StockTransferItem {
  id: string;
  transferId: string;
  productId: string;
  productName: string;
  barcode: string;
  sourceBatchId?: string | null;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  destinationBatchId?: string | null;
  product?: {
    id: string;
    name: string;
    barcode: string;
    packSize?: number;
  };
  sourceBatch?: {
    id: string;
    batchNumber: string;
    expiryDate: string;
  };
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  pharmacyId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  status: "PENDING" | "APPROVED" | "IN_TRANSIT" | "RECEIVED" | "REJECTED" | "CANCELLED";
  requestedById?: string | null;
  requestedByName?: string | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  receivedById?: string | null;
  receivedByName?: string | null;
  receivedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  sourceBranch?: { id: string; name: string; address?: string; phone?: string };
  destinationBranch?: { id: string; name: string; address?: string; phone?: string };
  items: StockTransferItem[];
}

export interface CreateTransferItemInput {
  productId: string;
  sourceBatchId?: string;
  quantity: number;
}

export interface CreateTransferInput {
  sourceBranchId: string;
  destinationBranchId: string;
  notes?: string;
  sendImmediately?: boolean;
  items: CreateTransferItemInput[];
}

export interface CrossBranchStockItem {
  branchId: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
  allowPriceOverride: boolean;
  hasProductRecord: boolean;
  productId: string | null;
  stockQty: number;
  catalogSalePrice: number;
  effectiveSalePrice: number;
  hasPriceOverride: boolean;
  priceOverrideReason: string | null;
  lastUpdated: string | null;
  batches: Array<{
    id: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    costPrice: number;
    salePrice: number;
    isRecalled: boolean;
    status: string;
  }>;
}

export interface CrossBranchStockResponse {
  productName: string;
  barcode: string;
  totalStockAcrossAllBranches: number;
  branches: CrossBranchStockItem[];
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
  countryCode?: string;
  countryName?: string;
  city?: string;
  currency?: string;
  timezone?: string;
  isEmailVerified?: boolean;
  emailVerifiedAt?: string | null;
  isPhoneVerified?: boolean;
  phoneVerifiedAt?: string | null;
  gracePeriod?: {
    daysRemaining: number;
    isRestricted: boolean;
    isGracePeriodActive: boolean;
    isEmailVerified: boolean;
  };
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
  countryCode?: string;
  countryName?: string;
  city?: string;
  currency?: string;
}

export interface PharmacyProfile {
  id: string;
  name: string;
  slug: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  countryCode: string;
  countryName: string;
  city: string;
  currency: string;
  isEmailVerified: boolean;
  emailVerifiedAt: string | null;
  isPhoneVerified: boolean;
  phoneVerifiedAt: string | null;
  gracePeriod: {
    daysRemaining: number;
    isRestricted: boolean;
    isGracePeriodActive: boolean;
    isEmailVerified: boolean;
  };
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
  pharmacyProfile?: PharmacyProfile | null;
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

// ---------------------------------------------------------------------------
// Drug Master Data (Pillar B & C)
// ---------------------------------------------------------------------------

export type DosageForm =
  | "TABLET"
  | "CAPSULE"
  | "SYRUP"
  | "INJECTION"
  | "CREAM"
  | "DROPS"
  | "INHALER"
  | "PATCH"
  | "SUPPOSITORY"
  | "OTHER";

export type BaseUnit = "TABLET" | "CAPSULE" | "ML" | "MG" | "UNIT" | "PIECE";
export type PackageUnit = "BOX" | "BOTTLE" | "STRIP" | "VIAL" | "TUBE" | "SACHET" | "PIECE";

export interface DrugMasterBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityInBaseUnits: number;
  status: string;
}

export interface DrugMasterProduct {
  id: string;
  name: string;
  nameEn: string;
  nameAr: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  regulatoryCode?: string | null;
  sfdaCode: string | null;
  isRx: boolean;
  isControlled: boolean;
  isPriceRegulated: boolean;
  publicPrice: number | string;
  baseUnit: string;
  packageUnit: string;
  unitsPerPack: number;
  packSize: number;
  barcode: string;
  category: string;
  active: number;
}

export interface DrugMasterDetail extends DrugMasterProduct {
  batches?: DrugMasterBatch[];
}

export interface DrugMasterSearchParams {
  q?: string;
  isRx?: boolean;
  isControlled?: boolean;
  dosageForm?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface DrugMasterSearchResult {
  data: DrugMasterProduct[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface DrugMasterUpdateInput {
  nameEn?: string;
  nameAr?: string;
  genericName?: string;
  dosageForm?: string;
  strength?: string;
  regulatoryCode?: string;
  sfdaCode?: string;
  isRx?: boolean;
  isControlled?: boolean;
  isPriceRegulated?: boolean;
  publicPrice?: number;
  baseUnit?: string;
  packageUnit?: string;
  unitsPerPack?: number;
}

export interface BulkImportRow {
  productId: string;
  nameEn?: string;
  nameAr?: string;
  genericName?: string;
  dosageForm?: string;
  strength?: string;
  regulatoryCode?: string;
  sfdaCode?: string;
  isRx?: boolean | string;
  isControlled?: boolean | string;
  isPriceRegulated?: boolean | string;
  publicPrice?: number | string;
  baseUnit?: string;
  packageUnit?: string;
  unitsPerPack?: number | string;
}

export interface BulkImportResult {
  summary: {
    total: number;
    ok: number;
    notFound: number;
    errors: number;
  };
  results: Array<{
    productId: string;
    status: "ok" | "not_found" | "error";
    error?: string;
  }>;
}

export interface ExpiryScanResult {
  expiredMarked: number;
  depletedMarked: number;
  nearExpiryAlerts: number;
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  prescribedDrugName: string;
  productId?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  quantityRemaining: number;
  status: "PENDING" | "PARTIAL" | "COMPLETED";
  isControlled: boolean;
  product?: Product;
}

export interface DispenseRecord {
  id: string;
  prescriptionId: string;
  prescriptionItemId: string;
  dispensedProductId: string;
  batchId?: string | null;
  quantity: number;
  isPartialFill: boolean;
  isSubstitution: boolean;
  originalProductId?: string | null;
  substitutionReason?: string | null;
  pharmacistId?: string | null;
  pharmacistName?: string | null;
  dispensedAt: string;
  notes?: string;
  dispensedProduct?: { id: string; name: string; genericName?: string; salePrice?: number };
  batch?: { id: string; batchNumber: string; expiryDate: string };
}

export interface Prescription {
  id: string;
  pharmacyId: string;
  branchId: string;
  prescriptionNumber: string;
  patientName: string;
  patientIdentifier: string;
  patientPhone: string;
  patientAge?: number | null;
  patientGender?: "MALE" | "FEMALE" | "OTHER" | null;
  doctorName: string;
  doctorLicense: string;
  clinicOrHospital: string;
  diagnosis: string;
  prescribedDate: string;
  status: "PENDING" | "VERIFIED" | "PARTIALLY_DISPENSED" | "FULLY_DISPENSED" | "CANCELLED";
  verifiedById?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  notes: string;
  createdAt: string;
  items: PrescriptionItem[];
  dispenseRecords?: DispenseRecord[];
  controlledRegisters?: ControlledDrugRegister[];
}

export interface ControlledDrugRegister {
  id: string;
  pharmacyId: string;
  branchId: string;
  productId: string;
  batchId?: string | null;
  prescriptionId?: string | null;
  dispenseRecordId?: string | null;
  patientName: string;
  patientIdentifier: string;
  doctorName: string;
  doctorLicense: string;
  transactionType: "DISPENSE" | "RECEIPT" | "ADJUSTMENT" | "DISCARD";
  quantity: number;
  balanceAfter: number;
  pharmacistId?: string | null;
  pharmacistName: string;
  witnessName?: string | null;
  notes: string;
  recordedAt: string;
  product?: { id: string; name: string; genericName?: string; dosageForm?: string; strength?: string; schedule?: string };
  batch?: { id: string; batchNumber: string; expiryDate?: string };
  prescription?: { id: string; prescriptionNumber: string; prescribedDate?: string };
}

export interface GenericSubstitutionOption {
  id: string;
  name: string;
  genericName?: string;
  dosageForm?: string;
  strength?: string;
  salePrice: number;
  stockQty: number;
  priceDifference: number;
  isCheaper: boolean;
  sameDosageForm: boolean;
  batches?: Array<{ id: string; batchNumber: string; expiryDate: string; quantity: number }>;
}

export interface SubstitutionSuggestionResult {
  originalProduct: {
    id: string;
    name: string;
    genericName?: string;
    dosageForm?: string;
    strength?: string;
    salePrice: number;
    stockQty: number;
  };
  hasGenericAlternatives: boolean;
  substitutions: GenericSubstitutionOption[];
}

export interface MarginReportItem {
  key: string;
  label: string;
  subLabel?: string;
  quantity: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  salesCount: number;
}

export interface MarginReport {
  groupBy: "drug" | "category" | "supplier" | "branch";
  totalQuantity: number;
  totalRevenue: number;
  totalCogs: number;
  totalGrossProfit: number;
  overallMarginPercent: number;
  items: MarginReportItem[];
}

export interface LossItem {
  id: string;
  productId?: string;
  productName: string;
  barcode: string;
  batchNumber: string;
  unitsLost: number;
  unitCost: number;
  estimatedLoss: number;
  reason: string;
  date: string;
}

export interface LossReportSummary {
  totalLoss: number;
  adjustmentLoss: number;
  expiryLoss: number;
  customerRefunds: number;
}

export interface LossReport {
  summary: LossReportSummary;
  adjustmentLosses: LossItem[];
  expiredDiscards: LossItem[];
  returnsCount: number;
}

export interface StockValuationSummary {
  totalActiveBatches: number;
  totalUnits: number;
  totalCostValuation: number;
  totalRetailValuation: number;
  potentialGrossProfit: number;
  potentialMarginPercent: number;
}

export interface StockValuationCategory {
  category: string;
  units: number;
  costValue: number;
  retailValue: number;
}

export interface StockValuationBranch {
  branchId: string;
  branchName: string;
  units: number;
  costValue: number;
  retailValue: number;
}

export interface StockValuation {
  summary: StockValuationSummary;
  byCategory: StockValuationCategory[];
  byBranch: StockValuationBranch[];
}

export interface ProfitAndLoss {
  period: {
    startDate: string;
    endDate: string;
  };
  salesRevenue: {
    grossSales: number;
    discounts: number;
    vatCollected: number;
    netSales: number;
    salesCount: number;
  };
  costOfGoodsSold: {
    totalCogs: number;
    grossProfit: number;
    grossMarginPercent: number;
  };
  operatingExpenses: {
    total: number;
    byCategory: Array<{ category: string; amount: number }>;
  };
  netProfit: {
    netOperatingProfit: number;
    netProfitMarginPercent: number;
  };
  taxAndVat: {
    vatCollectedOnSales: number;
    vatPaidOnPurchases: number;
    netVatPayable: number;
    totalPurchases: number;
  };
}

export interface PosShift {
  id: string;
  pharmacyId: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  shiftNumber: number;
  openedAt: string;
  closedAt?: string | null;
  status: "OPEN" | "CLOSED";
  openingCash: number;
  expectedCash: number;
  actualCash?: number | null;
  cashVariance?: number | null;
  totalCashSales: number;
  totalCardSales: number;
  totalCreditSales: number;
  totalSalesCount: number;
  totalReturns: number;
  totalCashDrops: number;
  closingNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string };
  cashDrops?: CashDrop[];
  liveExpectedCash?: number;
  metrics?: XReportData;
}

export interface CashDrop {
  id: string;
  shiftId: string;
  pharmacyId: string;
  branchId: string;
  userId: string;
  userName: string;
  type: "DROP" | "PAYOUT" | "FLOAT_ADD";
  amount: number;
  reason: string;
  createdAt: string;
}

export interface XReportData {
  shiftId: string;
  shiftNumber: number;
  status: string;
  cashierName: string;
  branchName: string;
  openedAt: string;
  readingAt: string;
  openingCash: number;
  salesSummary: {
    totalTransactions: number;
    grossSales: number;
    cashSales: { count: number; amount: number };
    cardSales: { count: number; amount: number };
    creditSales: { count: number; amount: number };
    splitSales: { count: number; amount: number };
  };
  returnsSummary: {
    totalReturns: number;
    cashRefunds: number;
    nonCashRefunds: number;
  };
  cashMovements: {
    dropsToSafe: { count: number; total: number };
    payouts: { count: number; total: number };
    floatAdds: { count: number; total: number };
    list: Array<{
      id: string;
      type: string;
      amount: number;
      reason: string;
      createdAt: string;
    }>;
  };
  cashDrawerSummary: {
    openingFloat: number;
    totalCashIn: number;
    totalCashOut: number;
    expectedCashInDrawer: number;
  };
}

export interface ZReportData extends XReportData {
  closedAt: string;
  actualCash: number;
  cashVariance: number;
  varianceStatus: "BALANCED" | "OVER" | "SHORT";
  closingNotes: string;
}

export type ReturnReason =
  | "NEAR_EXPIRY"
  | "DAMAGED"
  | "RECALLED"
  | "EXCESS_STOCK"
  | "EXPIRED"
  | "WRONG_ITEM"
  | "OTHER";

export interface SupplierReturnItem {
  id: string;
  returnId: string;
  productId: string;
  productName: string;
  batchId?: string | null;
  batchNumber: string;
  expiryDate?: string | null;
  quantityPacks: number;
  unitsPerPack: number;
  quantityBaseUnits: number;
  unitCost: number;
  totalCost: number;
  reason?: string;
  product?: { id: string; name: string; barcode: string; category?: string };
  batch?: { id: string; batchNumber: string; expiryDate: string; quantity: number };
}

export interface SupplierReturn {
  id: string;
  pharmacyId: string;
  branchId: string;
  distributorId: string;
  returnNumber: string;
  returnDate: string;
  invoiceId?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  totalAmount: number;
  creditNoteNumber?: string | null;
  creditNoteDate?: string | null;
  reason: ReturnReason;
  notes?: string;
  createdById?: string | null;
  createdByName?: string | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  distributor?: { id: string; name: string; phone?: string; address?: string };
  branch?: { id: string; name: string };
  invoice?: { id: string; invoiceNumber: string; totalAmount: number; balanceDue?: number; status?: string };
  items: SupplierReturnItem[];
}

export interface ReturnCandidate {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  daysToExpiry: number;
  quantityAvailable: number;
  unitCost: number;
  suggestedReason: ReturnReason;
  productId: string;
  productName: string;
  barcode: string;
  packSize: number;
  distributorId?: string | null;
  distributorName?: string;
}

export interface CreateSupplierReturnInput {
  distributorId: string;
  invoiceId?: string | null;
  reason: ReturnReason;
  notes?: string;
  autoApprove?: boolean;
  creditNoteNumber?: string | null;
  items: Array<{
    productId: string;
    batchId?: string | null;
    batchNumber: string;
    expiryDate?: string | null;
    quantityPacks: number;
    unitsPerPack?: number;
    unitCost: number;
    reason?: string;
  }>;
}

export interface ApproveSupplierReturnInput {
  creditNoteNumber?: string | null;
  creditNoteDate?: string | null;
  notes?: string;
}




