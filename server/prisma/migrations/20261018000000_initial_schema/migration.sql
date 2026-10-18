-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STAFF', 'ADMIN', 'OWNER');

-- CreateTable
CREATE TABLE "menus" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "image_url" VARCHAR(255),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "has_spice_level" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "order_code" VARCHAR(32) NOT NULL,
    "tracking_token_hash" VARCHAR(64) NOT NULL,
    "customer_name" VARCHAR(100) NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "order_type" "OrderType" NOT NULL,
    "table_number" SMALLINT,
    "total_amount" INTEGER NOT NULL,
    "order_status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "menu_id" INTEGER,
    "menu_name" VARCHAR(100) NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "spice_level" SMALLINT,
    "notes" VARCHAR(150),
    "subtotal" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "gateway_order_id" VARCHAR(64) NOT NULL,
    "snap_token" VARCHAR(255),
    "snap_redirect_url" VARCHAR(255),
    "transaction_id" VARCHAR(64),
    "payment_type" VARCHAR(50),
    "gross_amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gateway_transaction_status" VARCHAR(50),
    "gateway_fraud_status" VARCHAR(50),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_logs" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "previous_status" "OrderStatus",
    "new_status" "OrderStatus" NOT NULL,
    "changed_by" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menus_name_key" ON "menus"("name");

-- CreateIndex
CREATE INDEX "menus_is_deleted_is_available_idx" ON "menus"("is_deleted", "is_available");

-- CreateIndex
CREATE INDEX "menus_category_idx" ON "menus"("category");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");

-- CreateIndex
CREATE INDEX "orders_order_status_created_at_idx" ON "orders"("order_status", "created_at");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_tracking_token_hash_idx" ON "orders"("tracking_token_hash");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_gateway_order_id_key" ON "payment_attempts"("gateway_order_id");

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_status_idx" ON "payment_attempts"("order_id", "status");

-- CreateIndex
CREATE INDEX "order_status_logs_order_id_created_at_idx" ON "order_status_logs"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_logs" ADD CONSTRAINT "order_status_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
