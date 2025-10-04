-- CreateTable
CREATE TABLE "bitcoin_pay_payment_intents" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "email" TEXT,
    "amount_sats" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "address_id" TEXT,
    "memo" TEXT,
    "required_confs" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bitcoin_pay_payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitcoin_pay_deposit_addresses" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "derivation_index" INTEGER NOT NULL,
    "script_pub_key_hex" TEXT NOT NULL,
    "intent_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitcoin_pay_deposit_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitcoin_pay_tx_observations" (
    "id" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "vout" INTEGER NOT NULL,
    "value_sats" BIGINT NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "address_id" TEXT NOT NULL,
    "script_pub_key_hex" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bitcoin_pay_tx_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitcoin_pay_magic_link_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "intent_id" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "consumed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitcoin_pay_magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitcoin_pay_customers" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bitcoin_pay_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_password_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_password_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_todos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bitcoin_pay_payment_intents_status_idx" ON "bitcoin_pay_payment_intents"("status");

-- CreateIndex
CREATE INDEX "bitcoin_pay_payment_intents_customer_id_idx" ON "bitcoin_pay_payment_intents"("customer_id");

-- CreateIndex
CREATE INDEX "bitcoin_pay_payment_intents_email_idx" ON "bitcoin_pay_payment_intents"("email");

-- CreateIndex
CREATE INDEX "bitcoin_pay_payment_intents_expires_at_idx" ON "bitcoin_pay_payment_intents"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "bitcoin_pay_deposit_addresses_address_key" ON "bitcoin_pay_deposit_addresses"("address");

-- CreateIndex
CREATE INDEX "bitcoin_pay_deposit_addresses_address_idx" ON "bitcoin_pay_deposit_addresses"("address");

-- CreateIndex
CREATE INDEX "bitcoin_pay_deposit_addresses_intent_id_idx" ON "bitcoin_pay_deposit_addresses"("intent_id");

-- CreateIndex
CREATE INDEX "bitcoin_pay_deposit_addresses_derivation_index_idx" ON "bitcoin_pay_deposit_addresses"("derivation_index");

-- CreateIndex
CREATE INDEX "bitcoin_pay_tx_observations_txid_vout_idx" ON "bitcoin_pay_tx_observations"("txid", "vout");

-- CreateIndex
CREATE INDEX "bitcoin_pay_tx_observations_address_id_idx" ON "bitcoin_pay_tx_observations"("address_id");

-- CreateIndex
CREATE INDEX "bitcoin_pay_tx_observations_status_idx" ON "bitcoin_pay_tx_observations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bitcoin_pay_magic_link_tokens_token_key" ON "bitcoin_pay_magic_link_tokens"("token");

-- CreateIndex
CREATE INDEX "bitcoin_pay_magic_link_tokens_token_idx" ON "bitcoin_pay_magic_link_tokens"("token");

-- CreateIndex
CREATE INDEX "bitcoin_pay_magic_link_tokens_intent_id_idx" ON "bitcoin_pay_magic_link_tokens"("intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "bitcoin_pay_customers_email_key" ON "bitcoin_pay_customers"("email");

-- CreateIndex
CREATE INDEX "bitcoin_pay_customers_email_idx" ON "bitcoin_pay_customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_password_credentials_user_id_key" ON "app_password_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_sessions_session_token_key" ON "app_sessions"("session_token");

-- CreateIndex
CREATE INDEX "app_sessions_user_id_idx" ON "app_sessions"("user_id");

-- CreateIndex
CREATE INDEX "app_sessions_expires_at_idx" ON "app_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "app_todos_user_id_completed_idx" ON "app_todos"("user_id", "completed");

-- AddForeignKey
ALTER TABLE "app_password_credentials" ADD CONSTRAINT "app_password_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_todos" ADD CONSTRAINT "app_todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
