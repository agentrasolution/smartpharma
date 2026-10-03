-- AlterTable
ALTER TABLE "pharmacies" ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "country_code" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "country_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'SAR',
ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone_verified_at" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "product_prices" ADD COLUMN     "conversion_ratio" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "unit_type" TEXT DEFAULT 'UNIT';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "strips_per_pack" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "conversion_ratio" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "packaging_unit" TEXT DEFAULT 'UNIT',
ADD COLUMN     "quantity_base_units" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "shift_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "is_email_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pos_shifts" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "cashier_name" TEXT NOT NULL,
    "shift_number" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "opening_cash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expected_cash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual_cash" DOUBLE PRECISION,
    "cash_variance" DOUBLE PRECISION,
    "total_cash_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_card_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_credit_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_sales_count" INTEGER NOT NULL DEFAULT 0,
    "total_returns" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_cash_drops" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closing_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_drops" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DROP',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_drops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_returns" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "return_number" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoice_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "credit_note_number" TEXT,
    "credit_note_date" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT 'NEAR_EXPIRY',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "approved_by_id" TEXT,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "batch_number" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "quantity_packs" INTEGER NOT NULL DEFAULT 1,
    "units_per_pack" INTEGER NOT NULL DEFAULT 1,
    "quantity_base_units" INTEGER NOT NULL DEFAULT 1,
    "unit_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT,
    "target" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_shifts_pharmacy_id_idx" ON "pos_shifts"("pharmacy_id");

-- CreateIndex
CREATE INDEX "pos_shifts_branch_id_idx" ON "pos_shifts"("branch_id");

-- CreateIndex
CREATE INDEX "pos_shifts_cashier_id_idx" ON "pos_shifts"("cashier_id");

-- CreateIndex
CREATE INDEX "pos_shifts_status_idx" ON "pos_shifts"("status");

-- CreateIndex
CREATE INDEX "cash_drops_shift_id_idx" ON "cash_drops"("shift_id");

-- CreateIndex
CREATE INDEX "cash_drops_pharmacy_id_idx" ON "cash_drops"("pharmacy_id");

-- CreateIndex
CREATE INDEX "supplier_returns_pharmacy_id_idx" ON "supplier_returns"("pharmacy_id");

-- CreateIndex
CREATE INDEX "supplier_returns_branch_id_idx" ON "supplier_returns"("branch_id");

-- CreateIndex
CREATE INDEX "supplier_returns_distributor_id_idx" ON "supplier_returns"("distributor_id");

-- CreateIndex
CREATE INDEX "supplier_returns_invoice_id_idx" ON "supplier_returns"("invoice_id");

-- CreateIndex
CREATE INDEX "supplier_returns_status_idx" ON "supplier_returns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_returns_pharmacy_id_return_number_key" ON "supplier_returns"("pharmacy_id", "return_number");

-- CreateIndex
CREATE INDEX "supplier_return_items_return_id_idx" ON "supplier_return_items"("return_id");

-- CreateIndex
CREATE INDEX "supplier_return_items_product_id_idx" ON "supplier_return_items"("product_id");

-- CreateIndex
CREATE INDEX "supplier_return_items_batch_id_idx" ON "supplier_return_items"("batch_id");

-- CreateIndex
CREATE INDEX "verification_codes_target_type_idx" ON "verification_codes"("target", "type");

-- CreateIndex
CREATE INDEX "verification_codes_pharmacy_id_idx" ON "verification_codes"("pharmacy_id");

-- CreateIndex
CREATE INDEX "sales_shift_id_idx" ON "sales"("shift_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drops" ADD CONSTRAINT "cash_drops_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_items" ADD CONSTRAINT "supplier_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "supplier_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_items" ADD CONSTRAINT "supplier_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_items" ADD CONSTRAINT "supplier_return_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
