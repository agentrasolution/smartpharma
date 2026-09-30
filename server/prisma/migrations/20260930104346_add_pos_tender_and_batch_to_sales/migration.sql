-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "batch_number" TEXT,
ADD COLUMN     "expiry_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "card_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cash_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cashier_id" TEXT,
ADD COLUMN     "cashier_name" TEXT,
ADD COLUMN     "credit_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "payment_method" TEXT NOT NULL DEFAULT 'CASH',
ADD COLUMN     "prescription_id" TEXT,
ADD COLUMN     "prescription_number" TEXT;

-- CreateIndex
CREATE INDEX "sale_items_batch_id_idx" ON "sale_items"("batch_id");

-- CreateIndex
CREATE INDEX "sales_prescription_id_idx" ON "sales"("prescription_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
