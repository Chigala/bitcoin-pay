# @bitcoin-pay/core

A comprehensive Bitcoin payment SDK for TypeScript, featuring magic links, live status tracking, and webhooks.

## Features

- 🔗 **Magic Link Payments** - Email-based payment flow with secure signed tokens
- 📡 **Live Status Updates** - Real-time payment tracking via polling or SSE
- 🔔 **Event Webhooks** - Idempotent webhooks for processing, confirmed, expired events
- 🔌 **Plugin System** - Extensible architecture for subscriptions, refunds, and more
- 🗄️ **Multiple Adapters** - Support for Prisma, Drizzle, and custom storage
- 🌐 **Framework Agnostic** - Works with Next.js, Nuxt, SvelteKit, etc.
- 🔐 **Watch-Only** - No private keys required; secure address derivation
- ⚡ **React Hooks** - Built-in hooks for easy frontend integration

## Installation

```bash
npm install @bitcoin-pay/core
# or
pnpm add @bitcoin-pay/core
# or
yarn add @bitcoin-pay/core
```

## Quick Start

### 1. Server Setup

```typescript
import { createBitcoinPay } from "@bitcoin-pay/core";
import { drizzleAdapter } from "@bitcoin-pay/core/adapters/drizzle";
import { db } from "./db";

export const pay = createBitcoinPay({
  network: "mainnet",
  baseURL: process.env.PAY_BASE_URL!,
  secret: process.env.PAY_SECRET!,
  descriptor: process.env.PAY_DESCRIPTOR!, // watch-only xpub
  watcher: {
    backend: "core",
    core: {
      rpcUrl: process.env.BTC_RPC_URL!,
      rpcUser: process.env.BTC_RPC_USER!,
      rpcPass: process.env.BTC_RPC_PASS!,
      zmqTx: process.env.BTC_ZMQ_TX,
      zmqBlock: process.env.BTC_ZMQ_BLOCK,
    },
  },
  storage: drizzleAdapter(db, { provider: "pg" }),
  events: {
    async onIntentCreated({ email, magicLinkUrl }) {
      await sendEmail(email, magicLinkUrl);
    },
    async onConfirmed({ intentId }) {
      // Unlock features
    },
  },
});

await pay.migrate();
await pay.startWatcher();
```

### 2. Create Payment

```typescript
// Create intent & send magic link
const intent = await pay.createPaymentIntent({
  email: "user@example.com",
  amountSats: 50000,
  expiresInMinutes: 60,
});

const { url } = await pay.createMagicLink({ intentId: intent.id });
// Email sent via onIntentCreated hook
```

### 3. Client (React)

```tsx
"use client";
import { usePaymentInit, usePaymentStatus } from "@bitcoin-pay/core/react";

export default function PayPage({ params }) {
  const { data } = usePaymentInit(params.token);
  const { status, confs } = usePaymentStatus(data?.intentId);

  return (
    <div>
      <h1>Pay {data?.amountSats} sats</h1>
      <img src={data?.qrCode} alt="QR" />
      <p>Status: {status}</p>
    </div>
  );
}
```

## Architecture

Inspired by [Better Auth](https://github.com/better-auth/better-auth), this SDK follows similar patterns:

- **Plugin System** - Extend functionality with subscriptions, refunds, etc.
- **Database Adapters** - Works with any database via adapters
- **Framework Hooks** - React, Vue, Svelte client libraries
- **Type-Safe** - Full TypeScript support with inference

## Payment Flow

```
1. User clicks "Pay" → createPaymentIntent({ email, amountSats })
2. SDK creates magic link → createMagicLink({ intentId })
3. Email sent → onIntentCreated({ email, magicLinkUrl })
4. User clicks link → /pay/:token page loads
5. Page calls verifyMagicLink + ensureAssigned
6. Address derived + shown with QR code
7. Watcher monitors blockchain
8. TX seen → status = "processing" → onProcessing()
9. Confs >= N → status = "confirmed" → onConfirmed()
10. Integrator unlocks features
```

## Plugins

### Subscriptions

```typescript
import { subscriptions } from "@bitcoin-pay/core/plugins/subscriptions";

const pay = createBitcoinPay({
  plugins: [subscriptions()],
});
```

### Refunds

```typescript
import { refunds } from "@bitcoin-pay/core/plugins/refunds";

const pay = createBitcoinPay({
  plugins: [
    refunds({
      autoRefundThreshold: 10000, // sats
      dustThreshold: 546,
    }),
  ],
});
```

## Documentation

- [Usage Guide](../../USAGE.md)
- [API Reference](./docs/api.md)
- [Plugin Development](./docs/plugins.md)

## Security

- **No Private Keys** - Watch-only descriptors only
- **Signed Tokens** - HMAC-SHA256 magic link tokens
- **Single-Use** - Magic links consumed after first use
- **Idempotent** - Safe retries on webhooks and events

## Roadmap

- [x] Core payment flow
- [x] Magic links
- [x] React hooks
- [x] Subscriptions plugin
- [x] Refunds plugin
- [ ] Bitcoin Core watcher (ZMQ)
- [ ] Electrum watcher
- [ ] Esplora watcher
- [ ] SSE status updates
- [ ] Lightning support
- [ ] Vue/Svelte hooks
- [ ] Prisma adapter
- [ ] CLI migrations

## License

MIT

## Contributing

Contributions welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md)
