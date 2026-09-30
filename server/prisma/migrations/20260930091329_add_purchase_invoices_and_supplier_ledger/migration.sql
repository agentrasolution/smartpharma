-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "subtotal" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "payment_method" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "received_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "batch_number" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "quantity_packs" INTEGER NOT NULL DEFAULT 1,
    "units_per_pack" INTEGER NOT NULL DEFAULT 1,
    "quantity_base_units" INTEGER NOT NULL DEFAULT 1,
    "unit_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_payments" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "amount" DECIMAL(12,4) NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'CASH',
    "reference_number" TEXT NOT NULL DEFAULT '',
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_invoices_pharmacy_id_idx" ON "purchase_invoices"("pharmacy_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_branch_id_idx" ON "purchase_invoices"("branch_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_distributor_id_idx" ON "purchase_invoices"("distributor_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_status_idx" ON "purchase_invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_pharmacy_id_distributor_id_invoice_number_key" ON "purchase_invoices"("pharmacy_id", "distributor_id", "invoice_number");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_invoice_id_idx" ON "purchase_invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_product_id_idx" ON "purchase_invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_batch_number_idx" ON "purchase_invoice_items"("batch_number");

-- CreateIndex
CREATE INDEX "distributor_payments_pharmacy_id_idx" ON "distributor_payments"("pharmacy_id");

-- CreateIndex
CREATE INDEX "distributor_payments_branch_id_idx" ON "distributor_payments"("branch_id");

-- CreateIndex
CREATE INDEX "distributor_payments_distributor_id_idx" ON "distributor_payments"("distributor_id");

-- CreateIndex
CREATE INDEX "distributor_payments_invoice_id_idx" ON "distributor_payments"("invoice_id");

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_payments" ADD CONSTRAINT "distributor_payments_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_payments" ADD CONSTRAINT "distributor_payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_payments" ADD CONSTRAINT "distributor_payments_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_payments" ADD CONSTRAINT "distributor_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
