import { pgTable, text, integer, timestamp, bigint, index } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_payment_intents_status").on(table.status),
    customerIdx: index("idx_payment_intents_customer").on(table.customerId),
    emailIdx: index("idx_payment_intents_email").on(table.email),
    expiresAtIdx: index("idx_payment_intents_expires_at").on(table.expiresAt),
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
    consumed: integer("consumed").notNull().default(0), // SQLite compat
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
