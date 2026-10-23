import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create Enums
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('SUPER_ADMIN', 'BRANCH_MANAGER', 'STAFF');
      CREATE TYPE "stock_movement_reason_enum" AS ENUM ('ADJUSTMENT', 'ORDER_PLACED', 'ORDER_CANCELLED');
      CREATE TYPE "order_status_enum" AS ENUM ('PLACED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED');
    `);

    // Table: branches
    await queryRunner.query(`
      CREATE TABLE "branches" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(50) NOT NULL,
        "address" TEXT NOT NULL,
        "phone" VARCHAR(50) NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_branches_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_branches_name" UNIQUE ("name"),
        CONSTRAINT "UQ_branches_code" UNIQUE ("code")
      );
    `);

    // Table: users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "email" VARCHAR(255) NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "full_name" VARCHAR(255) NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'STAFF',
        "branch_id" UUID,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "FK_users_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL
      );
      CREATE INDEX "IDX_users_email" ON "users" ("email");
      CREATE INDEX "IDX_users_branch_id" ON "users" ("branch_id");
    `);

    // Table: products
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "sku" VARCHAR(100) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "price_paise" INTEGER NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_products_sku" UNIQUE ("sku"),
        CONSTRAINT "CHK_products_price_paise" CHECK ("price_paise" >= 0)
      );
      CREATE INDEX "IDX_products_sku" ON "products" ("sku");
    `);

    // Table: customers
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "branch_id" UUID NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(50) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customers_branch_email" UNIQUE ("branch_id", "email"),
        CONSTRAINT "FK_customers_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_customers_branch_id" ON "customers" ("branch_id");
    `);

    // Table: inventories
    await queryRunner.query(`
      CREATE TABLE "inventories" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "branch_id" UUID NOT NULL,
        "product_id" UUID NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_inventories_branch_product" UNIQUE ("branch_id", "product_id"),
        CONSTRAINT "CHK_inventories_quantity" CHECK ("quantity" >= 0),
        CONSTRAINT "FK_inventories_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_inventories_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_inventories_branch_id" ON "inventories" ("branch_id");
      CREATE INDEX "IDX_inventories_product_id" ON "inventories" ("product_id");
    `);

    // Table: stock_movements
    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "branch_id" UUID NOT NULL,
        "product_id" UUID NOT NULL,
        "quantity_change" INTEGER NOT NULL,
        "balance_after" INTEGER NOT NULL,
        "reason" "stock_movement_reason_enum" NOT NULL,
        "reference_id" VARCHAR(255),
        "actor_id" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_movements_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_stock_movements_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_stock_movements_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
      CREATE INDEX "IDX_stock_movements_branch_id" ON "stock_movements" ("branch_id");
      CREATE INDEX "IDX_stock_movements_product_id" ON "stock_movements" ("product_id");
      CREATE INDEX "IDX_stock_movements_actor_id" ON "stock_movements" ("actor_id");
    `);

    // Table: orders
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "order_number" VARCHAR(100) NOT NULL,
        "branch_id" UUID NOT NULL,
        "customer_id" UUID NOT NULL,
        "status" "order_status_enum" NOT NULL DEFAULT 'PLACED',
        "total_amount_paise" INTEGER NOT NULL,
        "created_by_id" UUID NOT NULL,
        "cancelled_at" TIMESTAMPTZ,
        "cancellation_reason" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_order_number" UNIQUE ("order_number"),
        CONSTRAINT "CHK_orders_total_amount_paise" CHECK ("total_amount_paise" >= 0),
        CONSTRAINT "FK_orders_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_orders_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_orders_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_orders_branch_id" ON "orders" ("branch_id");
      CREATE INDEX "IDX_orders_customer_id" ON "orders" ("customer_id");
      CREATE INDEX "IDX_orders_status" ON "orders" ("status");
      CREATE INDEX "IDX_orders_created_at" ON "orders" ("created_at");
    `);

    // Table: order_items
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" UUID NOT NULL,
        "product_id" UUID NOT NULL,
        "quantity" INTEGER NOT NULL,
        "unit_price_paise" INTEGER NOT NULL,
        "subtotal_paise" INTEGER NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_order_items_quantity" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_order_items_unit_price" CHECK ("unit_price_paise" >= 0),
        CONSTRAINT "CHK_order_items_subtotal" CHECK ("subtotal_paise" >= 0),
        CONSTRAINT "FK_order_items_order_id" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
      );
      CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id");
      CREATE INDEX "IDX_order_items_product_id" ON "order_items" ("product_id");
    `);

    // Table: refresh_tokens
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" UUID NOT NULL,
        "token_hash" VARCHAR(255) NOT NULL,
        "is_revoked" BOOLEAN NOT NULL DEFAULT false,
        "replaced_by_token_id" UUID,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id");
      CREATE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash");
    `);

    // Table: audit_logs
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id" UUID,
        "actor_email" VARCHAR(255),
        "action" VARCHAR(100) NOT NULL,
        "entity_type" VARCHAR(100) NOT NULL,
        "entity_id" VARCHAR(255),
        "branch_id" UUID,
        "metadata" JSONB,
        "ip_address" VARCHAR(100),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
      CREATE INDEX "IDX_audit_logs_actor_id" ON "audit_logs" ("actor_id");
      CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action");
      CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id");
      CREATE INDEX "IDX_audit_logs_branch_id" ON "audit_logs" ("branch_id");
      CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventories" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "branches" CASCADE`);

    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "stock_movement_reason_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
