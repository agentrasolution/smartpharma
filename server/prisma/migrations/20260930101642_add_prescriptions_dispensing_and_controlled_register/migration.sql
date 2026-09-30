-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "prescription_number" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_identifier" TEXT NOT NULL DEFAULT '',
    "patient_phone" TEXT NOT NULL DEFAULT '',
    "patient_age" INTEGER,
    "patient_gender" TEXT,
    "doctor_name" TEXT NOT NULL,
    "doctor_license" TEXT NOT NULL DEFAULT '',
    "clinic_or_hospital" TEXT NOT NULL DEFAULT '',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "prescribed_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verified_by_id" TEXT,
    "verified_by_name" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "prescribed_drug_name" TEXT NOT NULL,
    "product_id" TEXT,
    "dosage" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "quantity_prescribed" INTEGER NOT NULL,
    "quantity_dispensed" INTEGER NOT NULL DEFAULT 0,
    "quantity_remaining" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "is_controlled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispense_records" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "prescription_item_id" TEXT NOT NULL,
    "dispensed_product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "is_partial_fill" BOOLEAN NOT NULL DEFAULT false,
    "is_substitution" BOOLEAN NOT NULL DEFAULT false,
    "original_product_id" TEXT,
    "substitution_reason" TEXT,
    "pharmacist_id" TEXT,
    "pharmacist_name" TEXT,
    "dispensed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "dispense_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controlled_drug_registers" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "prescription_id" TEXT,
    "dispense_record_id" TEXT,
    "patient_name" TEXT NOT NULL,
    "patient_identifier" TEXT NOT NULL,
    "doctor_name" TEXT NOT NULL,
    "doctor_license" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "pharmacist_id" TEXT,
    "pharmacist_name" TEXT NOT NULL,
    "witness_name" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "controlled_drug_registers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescriptions_pharmacy_id_idx" ON "prescriptions"("pharmacy_id");

-- CreateIndex
CREATE INDEX "prescriptions_branch_id_idx" ON "prescriptions"("branch_id");

-- CreateIndex
CREATE INDEX "prescriptions_status_idx" ON "prescriptions"("status");

-- CreateIndex
CREATE INDEX "prescriptions_patient_identifier_idx" ON "prescriptions"("patient_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_pharmacy_id_prescription_number_key" ON "prescriptions"("pharmacy_id", "prescription_number");

-- CreateIndex
CREATE INDEX "prescription_items_prescription_id_idx" ON "prescription_items"("prescription_id");

-- CreateIndex
CREATE INDEX "prescription_items_product_id_idx" ON "prescription_items"("product_id");

-- CreateIndex
CREATE INDEX "dispense_records_prescription_id_idx" ON "dispense_records"("prescription_id");

-- CreateIndex
CREATE INDEX "dispense_records_prescription_item_id_idx" ON "dispense_records"("prescription_item_id");

-- CreateIndex
CREATE INDEX "dispense_records_dispensed_product_id_idx" ON "dispense_records"("dispensed_product_id");

-- CreateIndex
CREATE INDEX "dispense_records_dispensed_at_idx" ON "dispense_records"("dispensed_at");

-- CreateIndex
CREATE INDEX "controlled_drug_registers_pharmacy_id_idx" ON "controlled_drug_registers"("pharmacy_id");

-- CreateIndex
CREATE INDEX "controlled_drug_registers_branch_id_idx" ON "controlled_drug_registers"("branch_id");

-- CreateIndex
CREATE INDEX "controlled_drug_registers_product_id_idx" ON "controlled_drug_registers"("product_id");

-- CreateIndex
CREATE INDEX "controlled_drug_registers_recorded_at_idx" ON "controlled_drug_registers"("recorded_at");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_records" ADD CONSTRAINT "dispense_records_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_records" ADD CONSTRAINT "dispense_records_prescription_item_id_fkey" FOREIGN KEY ("prescription_item_id") REFERENCES "prescription_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_records" ADD CONSTRAINT "dispense_records_dispensed_product_id_fkey" FOREIGN KEY ("dispensed_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_records" ADD CONSTRAINT "dispense_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_drug_registers" ADD CONSTRAINT "controlled_drug_registers_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_drug_registers" ADD CONSTRAINT "controlled_drug_registers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_drug_registers" ADD CONSTRAINT "controlled_drug_registers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_drug_registers" ADD CONSTRAINT "controlled_drug_registers_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_drug_registers" ADD CONSTRAINT "controlled_drug_registers_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_drug_registers" ADD CONSTRAINT "controlled_drug_registers_dispense_record_id_fkey" FOREIGN KEY ("dispense_record_id") REFERENCES "dispense_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
