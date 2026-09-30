-- DropForeignKey
ALTER TABLE "arrears" DROP CONSTRAINT "arrears_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "arrears" DROP CONSTRAINT "arrears_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "arrears" DROP CONSTRAINT "arrears_sale_id_fkey";

-- DropForeignKey
ALTER TABLE "barcodes" DROP CONSTRAINT "barcodes_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "distributors" DROP CONSTRAINT "distributors_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "recovery_keys" DROP CONSTRAINT "recovery_keys_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "returns" DROP CONSTRAINT "returns_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "returns" DROP CONSTRAINT "returns_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_pharmacy_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_purchases" DROP CONSTRAINT "stock_purchases_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_purchases" DROP CONSTRAINT "stock_purchases_pharmacy_id_fkey";

-- DropIndex
DROP INDEX "idx_products_barcode_trgm";

-- DropIndex
DROP INDEX "idx_products_name_trgm";

-- AlterTable
ALTER TABLE "ai_messages" ADD COLUMN     "thought_signature" TEXT,
ADD COLUMN     "tool_calls" JSONB;

-- AlterTable
ALTER TABLE "arrears" ALTER COLUMN "sale_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "branches" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "father_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "father_phone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "base_unit" TEXT NOT NULL DEFAULT 'TABLET',
ADD COLUMN     "dosage_form" TEXT NOT NULL DEFAULT 'TABLET',
ADD COLUMN     "generic_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "is_controlled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_price_regulated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_rx" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name_ar" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name_en" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pack_size" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "package_unit" TEXT NOT NULL DEFAULT 'BOX',
ADD COLUMN     "public_price" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "sfda_code" TEXT,
ADD COLUMN     "strength" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "units_per_pack" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "stock_purchases" ADD COLUMN     "active" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "quantity_in_base_units" INTEGER NOT NULL DEFAULT 0,
    "cost_price_per_unit" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "sale_price_per_unit" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_recalled" BOOLEAN NOT NULL DEFAULT false,
    "recall_reason" TEXT,
    "gtin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "movement_type" TEXT NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reference_number" TEXT,
    "reason_code" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batches_branch_id_product_id_expiry_date_idx" ON "batches"("branch_id", "product_id", "expiry_date");

-- CreateIndex
CREATE INDEX "batches_is_recalled_status_idx" ON "batches"("is_recalled", "status");

-- CreateIndex
CREATE UNIQUE INDEX "batches_branch_id_product_id_batch_number_key" ON "batches"("branch_id", "product_id", "batch_number");

-- CreateIndex
CREATE INDEX "stock_movements_branch_id_product_id_created_at_idx" ON "stock_movements"("branch_id", "product_id", "created_at");

-- CreateIndex
CREATE INDEX "categories_pharmacy_id_idx" ON "categories"("pharmacy_id");

-- CreateIndex
CREATE INDEX "companies_pharmacy_id_idx" ON "companies"("pharmacy_id");

-- CreateIndex
CREATE INDEX "distributors_pharmacy_id_idx" ON "distributors"("pharmacy_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_keys" ADD CONSTRAINT "recovery_keys_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arrears" ADD CONSTRAINT "arrears_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arrears" ADD CONSTRAINT "arrears_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arrears" ADD CONSTRAINT "arrears_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
