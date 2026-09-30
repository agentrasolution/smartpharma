-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allow_credit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "blood_group" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "chronic_conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "consent_date" TIMESTAMP(3),
ADD COLUMN     "consent_given" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consent_notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "credit_limit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "emergency_contact_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emergency_contact_phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gender" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "national_id" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "chronic_medications" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "product_id" TEXT,
    "medication_name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT NOT NULL DEFAULT '',
    "days_supply" INTEGER NOT NULL DEFAULT 30,
    "last_dispensed_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_refill_date" TIMESTAMP(3) NOT NULL,
    "reminder_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT NOT NULL DEFAULT '',
    "last_contacted_at" TIMESTAMP(3),
    "contact_notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chronic_medications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chronic_medications_pharmacy_id_idx" ON "chronic_medications"("pharmacy_id");

-- CreateIndex
CREATE INDEX "chronic_medications_branch_id_idx" ON "chronic_medications"("branch_id");

-- CreateIndex
CREATE INDEX "chronic_medications_customer_id_idx" ON "chronic_medications"("customer_id");

-- CreateIndex
CREATE INDEX "chronic_medications_next_refill_date_idx" ON "chronic_medications"("next_refill_date");

-- AddForeignKey
ALTER TABLE "chronic_medications" ADD CONSTRAINT "chronic_medications_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chronic_medications" ADD CONSTRAINT "chronic_medications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chronic_medications" ADD CONSTRAINT "chronic_medications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chronic_medications" ADD CONSTRAINT "chronic_medications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
