-- CreateTable
CREATE TABLE "arrear_payments" (
    "id" TEXT NOT NULL,
    "arrear_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_sale_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arrear_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "arrear_payments" ADD CONSTRAINT "arrear_payments_arrear_id_fkey" FOREIGN KEY ("arrear_id") REFERENCES "arrears"("id") ON DELETE CASCADE ON UPDATE CASCADE;
