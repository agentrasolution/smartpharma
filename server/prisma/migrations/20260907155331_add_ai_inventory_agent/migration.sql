-- CreateTable
CREATE TABLE "inventory_config" (
    "id" TEXT NOT NULL,
    "default_safety_stock_days" INTEGER NOT NULL DEFAULT 2,
    "default_target_stock_days" INTEGER NOT NULL DEFAULT 14,
    "default_analysis_days" INTEGER NOT NULL DEFAULT 30,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 10,
    "overstock_coverage_days" INTEGER NOT NULL DEFAULT 90,
    "trend_threshold_percent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_inventory_config" (
    "id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "default_lead_time_days" INTEGER NOT NULL DEFAULT 3,
    "minimum_order_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "distributor_inventory_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_distributor_config" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "lead_time_days" INTEGER,
    "minimum_order_qty" INTEGER,
    "purchase_price" DOUBLE PRECISION,
    "preferred" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_distributor_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "company_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_inventory_recommendations" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "distributor_id" TEXT,
    "risk_level" TEXT NOT NULL,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "average_daily_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock_coverage_days" DOUBLE PRECISION,
    "estimated_stockout_days" DOUBLE PRECISION,
    "lead_time_days" INTEGER,
    "reorder_point" DOUBLE PRECISION,
    "recommended_quantity" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "ai_inventory_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "agent_name" TEXT NOT NULL,
    "conversation_id" TEXT,
    "tool_name" TEXT,
    "action" TEXT NOT NULL,
    "input_json" JSONB,
    "output_json" JSONB,
    "status" TEXT NOT NULL,
    "approval_required" BOOLEAN NOT NULL DEFAULT false,
    "approval_status" TEXT,
    "approved_by" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tool_name" TEXT,
    "tool_call_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "distributor_inventory_config_distributor_id_key" ON "distributor_inventory_config"("distributor_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_distributor_config_product_id_distributor_id_key" ON "product_distributor_config"("product_id", "distributor_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_idempotency_key_key" ON "purchase_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "purchase_orders_distributor_id_idx" ON "purchase_orders"("distributor_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");

-- CreateIndex
CREATE INDEX "ai_inventory_recommendations_status_idx" ON "ai_inventory_recommendations"("status");

-- CreateIndex
CREATE INDEX "ai_inventory_recommendations_risk_level_idx" ON "ai_inventory_recommendations"("risk_level");

-- CreateIndex
CREATE INDEX "ai_inventory_recommendations_created_at_idx" ON "ai_inventory_recommendations"("created_at");

-- CreateIndex
CREATE INDEX "ai_audit_logs_created_at_idx" ON "ai_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_audit_logs_user_id_idx" ON "ai_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");

-- AddForeignKey
ALTER TABLE "distributor_inventory_config" ADD CONSTRAINT "distributor_inventory_config_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_distributor_config" ADD CONSTRAINT "product_distributor_config_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_distributor_config" ADD CONSTRAINT "product_distributor_config_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_inventory_recommendations" ADD CONSTRAINT "ai_inventory_recommendations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;