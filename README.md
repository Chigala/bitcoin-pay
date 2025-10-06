# Bitcoin Pay

A comprehensive Bitcoin payment SDK for TypeScript, featuring magic links, live status tracking, and webhooks.

## Features

- 🔗 **Magic Link Payments** - Email-based payment flow with secure signed tokens
- 📡 **Live Status Updates** - Real-time payment tracking via polling or SSE
- 🔔 **Event Webhooks** - Idempotent webhooks for processing, confirmed, expired events
- 🔌 **Plugin System** - Extensible architecture for subscriptions, refunds, and more
- 🗄️ **Multiple Adapters** - Support for Prisma, Drizzle, and custom storage
- 🌐 **Framework Agnostic** - Works with Next.js, Nuxt, SvelteKit, etc.
- 🔐 **Watch-Only** - No private keys required; secure address derivation

## Packages

- `@bitcoin-pay/core` - Core SDK with server and client libraries
- `@bitcoin-pay/cli` - CLI tool for migrations and schema generation

## Quick Start

```bash
npm install @bitcoin-pay/core
```

### Database Setup

Bitcoin Pay requires specific database tables to function. Add these models to your Prisma schema:

<details>
<summary>📋 Prisma Schema (Click to expand)</summary>

```prisma
// Core payment models
model BitcoinPayPaymentIntent {
  id                 String    @id
  customerId         String?   @map("customer_id")
  email              String?
  amountSats         BigInt    @map("amount_sats")
  status             String
  addressId          String?   @map("address_id")
  memo               String?
  requiredConfs      Int       @default(1) @map("required_confs")
  expiresAt          DateTime  @map("expires_at")
  confirmedAt        DateTime? @map("confirmed_at")
  subscriptionId     String?   @map("subscription_id")
  billingCycleNumber Int?      @map("billing_cycle_number")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  @@index([status])
  @@index([customerId])
  @@index([email])
  @@index([expiresAt])
  @@index([subscriptionId])
  @@map("bitcoin_pay_payment_intents")
}

model BitcoinPayDepositAddress {
  id              String    @id
  address         String    @unique
  derivationIndex Int       @map("derivation_index")
  scriptPubKeyHex String    @map("script_pub_key_hex")
  intentId        String?   @map("intent_id")
  assignedAt      DateTime? @map("assigned_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  @@index([address])
  @@index([intentId])
  @@index([derivationIndex])
  @@map("bitcoin_pay_deposit_addresses")
}

model BitcoinPayTxObservation {
  id              String   @id
  txid            String
  vout            Int
  valueSats       BigInt   @map("value_sats")
  confirmations   Int      @default(0)
  addressId       String   @map("address_id")
  scriptPubKeyHex String   @map("script_pub_key_hex")
  status          String
  seenAt          DateTime @default(now()) @map("seen_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([txid, vout])
  @@index([addressId])
  @@index([status])
  @@map("bitcoin_pay_tx_observations")
}

model BitcoinPayMagicLinkToken {
  id         String    @id
  token      String    @unique
  intentId   String    @map("intent_id")
  consumed   Boolean   @default(false)
  consumedAt DateTime? @map("consumed_at")
  expiresAt  DateTime  @map("expires_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  @@index([token])
  @@index([intentId])
  @@map("bitcoin_pay_magic_link_tokens")
}

model BitcoinPayCustomer {
  id        String   @id
  email     String?  @unique
  metadata  Json?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([email])
  @@map("bitcoin_pay_customers")
}

// Subscription models (optional - only needed if using subscriptions)
model BitcoinPaySubscriptionPlan {
  id            String   @id
  name          String
  description   String?
  amountSats    BigInt   @map("amount_sats")
  currency      String   @default("BTC")
  interval      String
  intervalCount Int      @default(1) @map("interval_count")
  trialDays     Int?     @map("trial_days")
  maxCycles     Int?     @map("max_cycles")
  active        Boolean  @default(true)
  metadata      Json?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@index([active])
  @@map("bitcoin_pay_subscription_plans")
}

model BitcoinPaySubscription {
  id                   String    @id
  planId               String    @map("plan_id")
  customerId           String?   @map("customer_id")
  customerEmail        String?   @map("customer_email")
  status               String
  currentPeriodStart   DateTime  @map("current_period_start")
  currentPeriodEnd     DateTime  @map("current_period_end")
  trialStart           DateTime? @map("trial_start")
  trialEnd             DateTime? @map("trial_end")
  cyclesCompleted      Int       @default(0) @map("cycles_completed")
  lastPaymentIntentId  String?   @map("last_payment_intent_id")
  cancelAtPeriodEnd    Boolean   @default(false) @map("cancel_at_period_end")
  canceledAt           DateTime? @map("canceled_at")
  cancelReason         String?   @map("cancel_reason")
  metadata             Json?
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  @@index([planId])
  @@index([customerId])
  @@index([customerEmail])
  @@index([status])
  @@index([currentPeriodEnd])
  @@map("bitcoin_pay_subscriptions")
}

model BitcoinPaySystemMetadata {
  key       String   @id
  value     String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("bitcoin_pay_system_metadata")
}
```

</details>

After adding the schema, run:

```bash
npx prisma migrate dev --name add_bitcoin_pay_tables
npx prisma generate
```

> 💡 **Tip**: Check the [examples/nextjs/prisma/schema.prisma](./examples/nextjs/prisma/schema.prisma) for the complete working example.

See [documentation](./docs) for detailed setup and usage.

## Architecture

Inspired by [Better Auth](https://github.com/better-auth/better-auth), this SDK follows similar patterns for:

- Plugin system
- Database adapters
- Client hooks (React, Vue, Svelte)
- Type-safe APIs

## License

MIT
