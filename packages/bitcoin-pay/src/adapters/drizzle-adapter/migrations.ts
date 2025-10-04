import { sql } from "drizzle-orm";

export interface MigrationOptions {
  provider: "pg" | "mysql" | "sqlite";
}

interface DrizzleDB {
  execute: (query: unknown) => Promise<unknown>;
  run?: (query: unknown) => Promise<unknown>;
}

export async function runMigrations(
  db: DrizzleDB,
  options: MigrationOptions
): Promise<void> {
  const { provider } = options;

  if (provider === "pg") {
    await runPgMigrations(db);
  } else if (provider === "mysql") {
    await runMySqlMigrations(db);
  } else if (provider === "sqlite") {
    await runSqliteMigrations(db);
  }
}

async function runPgMigrations(db: DrizzleDB): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_payment_intents (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      email TEXT,
      amount_sats BIGINT NOT NULL,
      status TEXT NOT NULL,
      address_id TEXT,
      memo TEXT,
      required_confs INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMP NOT NULL,
      confirmed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_payment_intents_status
    ON bitcoin_pay_payment_intents(status);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_payment_intents_customer
    ON bitcoin_pay_payment_intents(customer_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_payment_intents_email
    ON bitcoin_pay_payment_intents(email);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_payment_intents_expires_at
    ON bitcoin_pay_payment_intents(expires_at);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_deposit_addresses (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      derivation_index INTEGER NOT NULL,
      script_pub_key_hex TEXT NOT NULL,
      intent_id TEXT,
      assigned_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address
    ON bitcoin_pay_deposit_addresses(address);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_deposit_addresses_intent
    ON bitcoin_pay_deposit_addresses(intent_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_deposit_addresses_derivation
    ON bitcoin_pay_deposit_addresses(derivation_index);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_tx_observations (
      id TEXT PRIMARY KEY,
      txid TEXT NOT NULL,
      vout INTEGER NOT NULL,
      value_sats BIGINT NOT NULL,
      confirmations INTEGER NOT NULL DEFAULT 0,
      address_id TEXT NOT NULL,
      script_pub_key_hex TEXT NOT NULL,
      status TEXT NOT NULL,
      seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tx_observations_txid_vout
    ON bitcoin_pay_tx_observations(txid, vout);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tx_observations_address
    ON bitcoin_pay_tx_observations(address_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tx_observations_status
    ON bitcoin_pay_tx_observations(status);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_magic_link_tokens (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      intent_id TEXT NOT NULL,
      consumed BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token
    ON bitcoin_pay_magic_link_tokens(token);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_intent
    ON bitcoin_pay_magic_link_tokens(intent_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_customers_email
    ON bitcoin_pay_customers(email);
  `);
}

async function runMySqlMigrations(db: DrizzleDB): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_payment_intents (
      id VARCHAR(255) PRIMARY KEY,
      customer_id VARCHAR(255),
      email VARCHAR(255),
      amount_sats BIGINT NOT NULL,
      status VARCHAR(50) NOT NULL,
      address_id VARCHAR(255),
      memo TEXT,
      required_confs INT NOT NULL DEFAULT 1,
      expires_at TIMESTAMP NOT NULL,
      confirmed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_payment_intents_status (status),
      INDEX idx_payment_intents_customer (customer_id),
      INDEX idx_payment_intents_email (email),
      INDEX idx_payment_intents_expires_at (expires_at)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_deposit_addresses (
      id VARCHAR(255) PRIMARY KEY,
      address VARCHAR(255) NOT NULL UNIQUE,
      derivation_index INT NOT NULL,
      script_pub_key_hex TEXT NOT NULL,
      intent_id VARCHAR(255),
      assigned_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_deposit_addresses_address (address),
      INDEX idx_deposit_addresses_intent (intent_id),
      INDEX idx_deposit_addresses_derivation (derivation_index)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_tx_observations (
      id VARCHAR(255) PRIMARY KEY,
      txid VARCHAR(255) NOT NULL,
      vout INT NOT NULL,
      value_sats BIGINT NOT NULL,
      confirmations INT NOT NULL DEFAULT 0,
      address_id VARCHAR(255) NOT NULL,
      script_pub_key_hex TEXT NOT NULL,
      status VARCHAR(50) NOT NULL,
      seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tx_observations_txid_vout (txid, vout),
      INDEX idx_tx_observations_address (address_id),
      INDEX idx_tx_observations_status (status)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_magic_link_tokens (
      id VARCHAR(255) PRIMARY KEY,
      token VARCHAR(255) NOT NULL UNIQUE,
      intent_id VARCHAR(255) NOT NULL,
      consumed BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_magic_link_tokens_token (token),
      INDEX idx_magic_link_tokens_intent (intent_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_customers (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customers_email (email)
    );
  `);
}

async function runSqliteMigrations(db: DrizzleDB): Promise<void> {
  if (!db.run) {
    throw new Error("SQLite migrations require db.run method");
  }

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_payment_intents (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      email TEXT,
      amount_sats INTEGER NOT NULL,
      status TEXT NOT NULL,
      address_id TEXT,
      memo TEXT,
      required_confs INTEGER NOT NULL DEFAULT 1,
      expires_at INTEGER NOT NULL,
      confirmed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_payment_intents_status
    ON bitcoin_pay_payment_intents(status);
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_payment_intents_customer
    ON bitcoin_pay_payment_intents(customer_id);
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_payment_intents_email
    ON bitcoin_pay_payment_intents(email);
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_payment_intents_expires_at
    ON bitcoin_pay_payment_intents(expires_at);
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_deposit_addresses (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      derivation_index INTEGER NOT NULL,
      script_pub_key_hex TEXT NOT NULL,
      intent_id TEXT,
      assigned_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address
    ON bitcoin_pay_deposit_addresses(address);
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_deposit_addresses_intent
    ON bitcoin_pay_deposit_addresses(intent_id);
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_deposit_addresses_derivation
    ON bitcoin_pay_deposit_addresses(derivation_index);
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_tx_observations (
      id TEXT PRIMARY KEY,
      txid TEXT NOT NULL,
      vout INTEGER NOT NULL,
      value_sats INTEGER NOT NULL,
      confirmations INTEGER NOT NULL DEFAULT 0,
      address_id TEXT NOT NULL,
      script_pub_key_hex TEXT NOT NULL,
      status TEXT NOT NULL,
      seen_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_tx_observations_txid_vout
    ON bitcoin_pay_tx_observations(txid, vout);
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_tx_observations_address
    ON bitcoin_pay_tx_observations(address_id);
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_tx_observations_status
    ON bitcoin_pay_tx_observations(status);
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_magic_link_tokens (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      intent_id TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token
    ON bitcoin_pay_magic_link_tokens(token);
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_intent
    ON bitcoin_pay_magic_link_tokens(intent_id);
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS bitcoin_pay_customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_customers_email
    ON bitcoin_pay_customers(email);
  `);
}
