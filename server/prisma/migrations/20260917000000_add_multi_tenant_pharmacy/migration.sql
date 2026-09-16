-- ============================================================
-- Multi-tenant pharmacy scope
-- Creates pharmacies + subscriptions, scopes every operational
-- entity to a pharmacy/branch, and backfills existing rows into
-- a default "Main Pharmacy" / "Main Branch".
-- ============================================================

-- ------------------------------------------------------------
-- 1. New tables
-- ------------------------------------------------------------
CREATE TABLE "pharmacies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pharmacies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'monthly',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'trial',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renews_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pharmacies_name_key" ON "pharmacies"("name");
CREATE UNIQUE INDEX "pharmacies_slug_key" ON "pharmacies"("slug");
CREATE UNIQUE INDEX "subscriptions_pharmacy_id_key" ON "subscriptions"("pharmacy_id");

-- ------------------------------------------------------------
-- 2. Seed a default pharmacy + trial subscription + main branch
-- ------------------------------------------------------------
INSERT INTO "pharmacies" ("id", "name", "slug", "contact", "phone", "email", "address", "is_active", "created_at", "updated_at")
VALUES ('11111111-1111-4111-8111-111111111111', 'Main Pharmacy', 'main', '', '', '', '', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "subscriptions" ("id", "pharmacy_id", "plan", "price", "status", "started_at", "renews_at", "created_at", "updated_at")
VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'monthly', 0, 'trial', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ------------------------------------------------------------
-- 3. Add scope columns (nullable first)
-- ------------------------------------------------------------
ALTER TABLE "branches" ADD COLUMN "pharmacy_id" TEXT;

INSERT INTO "branches" ("id", "pharmacy_id", "name", "address", "phone", "is_active", "created_at", "updated_at")
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Main Branch', '', '', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
ALTER TABLE "users" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "roles" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "recovery_keys" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "products" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "products" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "categories" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "distributors" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "companies" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "barcodes" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "customers" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "customers" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "sales" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "sales" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "arrears" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "arrears" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "stock_purchases" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "stock_purchases" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "returns" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "returns" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "branch_id" TEXT;

-- ------------------------------------------------------------
-- 4. Backfill
-- ------------------------------------------------------------
UPDATE "branches" SET "pharmacy_id" = '11111111-1111-4111-8111-111111111111' WHERE "pharmacy_id" IS NULL;

UPDATE "users" SET "pharmacy_id" = COALESCE(
    (SELECT b."pharmacy_id" FROM "branches" b WHERE b."id" = "users"."branch_id"),
    '11111111-1111-4111-8111-111111111111'
) WHERE "pharmacy_id" IS NULL;

UPDATE "roles" SET "pharmacy_id" = '11111111-1111-4111-8111-111111111111' WHERE "pharmacy_id" IS NULL;
UPDATE "recovery_keys" SET "pharmacy_id" = '11111111-1111-4111-8111-111111111111' WHERE "pharmacy_id" IS NULL;
UPDATE "categories" SET "pharmacy_id" = '11111111-1111-4111-8111-111111111111' WHERE "pharmacy_id" IS NULL;
UPDATE "distributors" SET "pharmacy_id" = '11111111-1111-4111-8111-111111111111' WHERE "pharmacy_id" IS NULL;
UPDATE "companies" SET "pharmacy_id" = '11111111-1111-4111-8111-111111111111' WHERE "pharmacy_id" IS NULL;
UPDATE "barcodes" SET "pharmacy_id" = '11111111-1111-4111-8111-111111111111' WHERE "pharmacy_id" IS NULL;

UPDATE "products" SET
    "pharmacy_id" = '11111111-1111-4111-8111-111111111111',
    "branch_id" = '22222222-2222-4222-8222-222222222222'
WHERE "pharmacy_id" IS NULL;

UPDATE "customers" SET
    "pharmacy_id" = '11111111-1111-4111-8111-111111111111',
    "branch_id" = '22222222-2222-4222-8222-222222222222'
WHERE "pharmacy_id" IS NULL;

UPDATE "sales" SET
    "pharmacy_id" = '11111111-1111-4111-8111-111111111111',
    "branch_id" = '22222222-2222-4222-8222-222222222222'
WHERE "pharmacy_id" IS NULL;

UPDATE "arrears" SET
    "pharmacy_id" = '11111111-1111-4111-8111-111111111111',
    "branch_id" = '22222222-2222-4222-8222-222222222222'
WHERE "pharmacy_id" IS NULL;

UPDATE "stock_purchases" SET
    "pharmacy_id" = '11111111-1111-4111-8111-111111111111',
    "branch_id" = '22222222-2222-4222-8222-222222222222'
WHERE "pharmacy_id" IS NULL;

UPDATE "returns" SET
    "pharmacy_id" = '11111111-1111-4111-8111-111111111111',
    "branch_id" = '22222222-2222-4222-8222-222222222222'
WHERE "pharmacy_id" IS NULL;

UPDATE "expenses" SET
    "pharmacy_id" = '11111111-1111-4111-8111-111111111111',
    "branch_id" = '22222222-2222-4222-8222-222222222222'
WHERE "pharmacy_id" IS NULL;

UPDATE "purchase_orders" SET
    "pharmacy_id" = '11111111-1111-4111-8111-111111111111',
    "branch_id" = '22222222-2222-4222-8222-222222222222'
WHERE "pharmacy_id" IS NULL;

-- ------------------------------------------------------------
-- 5. Make scope columns required
-- ------------------------------------------------------------
ALTER TABLE "branches" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "roles" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "distributors" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "companies" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "barcodes" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "customers" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "customers" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "arrears" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "arrears" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "stock_purchases" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "stock_purchases" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "returns" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "returns" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "purchase_orders" ALTER COLUMN "pharmacy_id" SET NOT NULL;
ALTER TABLE "purchase_orders" ALTER COLUMN "branch_id" SET NOT NULL;

-- ------------------------------------------------------------
-- 6. Foreign keys
-- ------------------------------------------------------------
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branches" ADD CONSTRAINT "branches_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_keys" ADD CONSTRAINT "recovery_keys_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arrears" ADD CONSTRAINT "arrears_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arrears" ADD CONSTRAINT "arrears_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- 7. Replace global-unique with pharmacy/branch-scoped unique
-- ------------------------------------------------------------
ALTER TABLE "products" DROP CONSTRAINT "products_barcode_key";
CREATE UNIQUE INDEX "products_branch_id_barcode_key" ON "products"("branch_id", "barcode");

ALTER TABLE "roles" DROP CONSTRAINT "roles_name_key";
DROP INDEX IF EXISTS "roles_name_key";
CREATE UNIQUE INDEX "roles_pharmacy_id_name_key" ON "roles"("pharmacy_id", "name");

ALTER TABLE "categories" DROP CONSTRAINT "categories_name_key";
CREATE UNIQUE INDEX "categories_pharmacy_id_name_key" ON "categories"("pharmacy_id", "name");

CREATE UNIQUE INDEX "distributors_pharmacy_id_name_key" ON "distributors"("pharmacy_id", "name");
CREATE UNIQUE INDEX "companies_pharmacy_id_name_key" ON "companies"("pharmacy_id", "name");

-- ------------------------------------------------------------
-- 8. Scope indexes
-- ------------------------------------------------------------
CREATE INDEX "branches_pharmacy_id_idx" ON "branches"("pharmacy_id");
CREATE INDEX "users_pharmacy_id_idx" ON "users"("pharmacy_id");
CREATE INDEX "roles_pharmacy_id_idx" ON "roles"("pharmacy_id");
CREATE INDEX "products_pharmacy_id_idx" ON "products"("pharmacy_id");
CREATE INDEX "products_branch_id_idx" ON "products"("branch_id");
CREATE INDEX "customers_pharmacy_id_idx" ON "customers"("pharmacy_id");
CREATE INDEX "customers_branch_id_idx" ON "customers"("branch_id");
CREATE INDEX "sales_pharmacy_id_idx" ON "sales"("pharmacy_id");
CREATE INDEX "sales_branch_id_idx" ON "sales"("branch_id");
CREATE INDEX "arrears_pharmacy_id_idx" ON "arrears"("pharmacy_id");
CREATE INDEX "arrears_branch_id_idx" ON "arrears"("branch_id");
CREATE INDEX "stock_purchases_pharmacy_id_idx" ON "stock_purchases"("pharmacy_id");
CREATE INDEX "stock_purchases_branch_id_idx" ON "stock_purchases"("branch_id");
CREATE INDEX "returns_pharmacy_id_idx" ON "returns"("pharmacy_id");
CREATE INDEX "returns_branch_id_idx" ON "returns"("branch_id");
CREATE INDEX "expenses_pharmacy_id_idx" ON "expenses"("pharmacy_id");
CREATE INDEX "expenses_branch_id_idx" ON "expenses"("branch_id");
CREATE INDEX "purchase_orders_pharmacy_id_idx" ON "purchase_orders"("pharmacy_id");
CREATE INDEX "purchase_orders_branch_id_idx" ON "purchase_orders"("branch_id");
CREATE INDEX "barcodes_pharmacy_id_idx" ON "barcodes"("pharmacy_id");