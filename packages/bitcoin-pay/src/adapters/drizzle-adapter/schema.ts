// PostgreSQL schema - use this as the main export
// For MySQL and SQLite, users should adapt the schema manually

import { pgTable, text, integer, timestamp, bigint, index } from "drizzle-orm/pg-core";
import type { InferSelectModel } from "drizzle-orm";

export const paymentIntents = pgTable(
  "bitcoin_pay_payment_intents",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id"),
    email: text("email"),
    amountSats: bigint("amount_sats", { mode: "number" }).notNull(),
    status: text("status").notNull(),
    addressId: text("address_id"),
    memo: text("memo"),
    requiredConfs: integer("required_confs").notNull().default(1),
    expiresAt: timestamp("expires_at").notNull(),
    confirmedAt: timestamp("confirmed_at"),
    subscriptionId: text("subscription_id"),
    billingCycleNumber: integer("billing_cycle_number"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_payment_intents_status").on(table.status),
    customerIdx: index("idx_payment_intents_customer").on(table.customerId),
    emailIdx: index("idx_payment_intents_email").on(table.email),
    expiresAtIdx: index("idx_payment_intents_expires_at").on(table.expiresAt),
    subscriptionIdx: index("idx_payment_intents_subscription").on(table.subscriptionId),
  }),
);

export const depositAddresses = pgTable(
  "bitcoin_pay_deposit_addresses",
  {
    id: text("id").primaryKey(),
    address: text("address").notNull().unique(),
    derivationIndex: integer("derivation_index").notNull(),
    scriptPubKeyHex: text("script_pub_key_hex").notNull(),
    intentId: text("intent_id"),
    assignedAt: timestamp("assigned_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    addressIdx: index("idx_deposit_addresses_address").on(table.address),
    intentIdx: index("idx_deposit_addresses_intent").on(table.intentId),
    derivationIdx: index("idx_deposit_addresses_derivation").on(table.derivationIndex),
  }),
);

export const txObservations = pgTable(
  "bitcoin_pay_tx_observations",
  {
    id: text("id").primaryKey(),
    txid: text("txid").notNull(),
    vout: integer("vout").notNull(),
    valueSats: bigint("value_sats", { mode: "number" }).notNull(),
    confirmations: integer("confirmations").notNull().default(0),
    addressId: text("address_id").notNull(),
    scriptPubKeyHex: text("script_pub_key_hex").notNull(),
    status: text("status").notNull(),
    seenAt: timestamp("seen_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    txidVoutIdx: index("idx_tx_observations_txid_vout").on(table.txid, table.vout),
    addressIdx: index("idx_tx_observations_address").on(table.addressId),
    statusIdx: index("idx_tx_observations_status").on(table.status),
  }),
);

export const magicLinkTokens = pgTable(
  "bitcoin_pay_magic_link_tokens",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    intentId: text("intent_id").notNull(),
    consumed: integer("consumed").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: index("idx_magic_link_tokens_token").on(table.token),
    intentIdx: index("idx_magic_link_tokens_intent").on(table.intentId),
  }),
);

export const customers = pgTable(
  "bitcoin_pay_customers",
  {
    id: text("id").primaryKey(),
    email: text("email").unique(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("idx_customers_email").on(table.email),
  }),
);

export const subscriptionPlans = pgTable(
  "bitcoin_pay_subscription_plans",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    amountSats: bigint("amount_sats", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BTC"),
    interval: text("interval").notNull(),
    intervalCount: integer("interval_count").notNull().default(1),
    maxCycles: integer("max_cycles"),
    trialDays: integer("trial_days"),
    metadata: text("metadata"),
    active: integer("active").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index("idx_subscription_plans_active").on(table.active),
  }),
);

export const subscriptions = pgTable(
  "bitcoin_pay_subscriptions",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull(),
    customerId: text("customer_id"),
    customerEmail: text("customer_email"),
    status: text("status").notNull(),
    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    cyclesCompleted: integer("cycles_completed").notNull().default(0),
    lastPaymentIntentId: text("last_payment_intent_id"),
    cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
    canceledAt: timestamp("canceled_at"),
    cancelReason: text("cancel_reason"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    customerIdx: index("idx_subscriptions_customer").on(table.customerId),
    statusIdx: index("idx_subscriptions_status").on(table.status),
    periodEndIdx: index("idx_subscriptions_period_end").on(table.currentPeriodEnd),
    planIdx: index("idx_subscriptions_plan").on(table.planId),
  }),
);

export const systemMetadata = pgTable("bitcoin_pay_system_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Type exports
export type PaymentIntentRow = InferSelectModel<typeof paymentIntents>;
export type DepositAddressRow = InferSelectModel<typeof depositAddresses>;
export type TxObservationRow = InferSelectModel<typeof txObservations>;
export type MagicLinkTokenRow = InferSelectModel<typeof magicLinkTokens>;
export type CustomerRow = InferSelectModel<typeof customers>;
export type SubscriptionPlanRow = InferSelectModel<typeof subscriptionPlans>;
export type SubscriptionRow = InferSelectModel<typeof subscriptions>;
export type SystemMetadataRow = InferSelectModel<typeof systemMetadata>;

// Export all tables as schema
export const schema = {
  paymentIntents,
  depositAddresses,
  txObservations,
  magicLinkTokens,
  customers,
  subscriptionPlans,
  subscriptions,
  systemMetadata,
};
