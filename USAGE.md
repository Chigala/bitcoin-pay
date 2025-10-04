# Bitcoin Pay SDK - Usage Guide

## Installation

```bash
npm install @bitcoin-pay/core
```

## Server Setup

### 1. Create Bitcoin Pay Instance

```typescript
// lib/pay.ts
import { createBitcoinPay } from "@bitcoin-pay/core";
import { drizzleAdapter } from "@bitcoin-pay/core/adapters/drizzle";
import { db } from "./db"; // your Drizzle instance

export const pay = createBitcoinPay({
  network: "mainnet",
  baseURL: process.env.PAY_BASE_URL!, // e.g., "https://example.com"
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
  confirmations: 1,
  events: {
    async onIntentCreated({ email, magicLinkUrl }) {
      // Send email with magic link
      await sendEmail(email, {
        subject: "Complete your payment",
        body: `Click here to pay: ${magicLinkUrl}`,
      });
    },
    async onProcessing({ intentId, txid, valueSats }) {
      console.log(`Payment processing: ${intentId}, tx: ${txid}`);
    },
    async onConfirmed({ intentId, txid, confs, valueSats }) {
      console.log(`Payment confirmed: ${intentId}`);
      // Unlock features, send receipt, etc.
    },
    async onExpired({ intentId }) {
      console.log(`Payment expired: ${intentId}`);
    },
  },
});

// Initialize
await pay.migrate();
await pay.startWatcher();
```

### 2. Create API Routes

#### Next.js App Router

```typescript
// app/api/payments/magic/route.ts
import { pay } from "@/lib/pay";

export async function POST(req: Request) {
  const { email, amountSats } = await req.json();

  const intent = await pay.createPaymentIntent({
    email,
    amountSats,
    expiresInMinutes: 60,
  });

  const { url } = await pay.createMagicLink({ intentId: intent.id });

  // Email is sent via events.onIntentCreated hook

  return new Response(null, { status: 204 });
}
```

```typescript
// app/api/pay/[...path]/route.ts
import { pay } from "@/lib/pay";

export async function GET(req: Request) {
  return pay.handler(req);
}
```

## Client Setup

### React

```typescript
// lib/pay-client.ts
import { createPaymentClient } from "@bitcoin-pay/core/react";

export const payClient = createPaymentClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
});

export * from "@bitcoin-pay/core/react";
```

### Payment Page

```tsx
// app/pay/[token]/page.tsx
"use client";

import { usePaymentInit, usePaymentStatus, useBip21QR, useExpiryCountdown } from "@/lib/pay-client";

export default function PayPage({ params }: { params: { token: string } }) {
  const { data, isPending, error } = usePaymentInit(params.token);
  const { status, confs } = usePaymentStatus(data?.intentId);
  const { qrData } = useBip21QR(data?.bip21);
  const { minutes, seconds } = useExpiryCountdown(data?.expiresAt);

  if (isPending) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h1>Pay {data.amountSats} sats</h1>

      {qrData && <img src={qrData} alt="QR Code" />}

      <p>Address: {data.address}</p>
      <p>Amount: {data.amountSats} sats</p>
      <p>Expires in: {minutes}m {seconds}s</p>

      <div>
        Status: {status}
        {status === "processing" && <span> ({confs} confs)</span>}
        {status === "confirmed" && <span> ✓ Paid!</span>}
      </div>
    </div>
  );
}
```

## Using Plugins

### Subscriptions

```typescript
import { createBitcoinPay } from "@bitcoin-pay/core";
import { subscriptions } from "@bitcoin-pay/core/plugins/subscriptions";

const pay = createBitcoinPay({
  // ...other options
  plugins: [subscriptions()],
});

// Create a subscription
const sub = await pay.createSubscription({
  customerId: "cust_123",
  planKey: "pro_monthly",
  amountSats: 150_000,
  period: "monthly",
  nextDueAt: new Date("2025-02-01"),
  email: "user@example.com",
});

// In your scheduler (Inngest, cron, etc.)
const due = await pay.listSubscriptionsDue({ before: new Date() });
for (const s of due) {
  const intent = await pay.createNextCycleIntent({ subscriptionId: s.id });
  await pay.advanceSubscription({ subscriptionId: s.id });
}
```

### Refunds

```typescript
import { refunds } from "@bitcoin-pay/core/plugins/refunds";

const pay = createBitcoinPay({
  // ...other options
  plugins: [
    refunds({
      autoRefundThreshold: 10000, // Auto-refund overpayments > 10k sats
      dustThreshold: 546,
      feePayer: "merchant",
    }),
  ],
});
```

## Environment Variables

```env
# Required
PAY_BASE_URL=https://example.com
PAY_SECRET=your-secret-key-32-chars-minimum
PAY_DESCRIPTOR=tr([fingerprint/86h/0h/0h]xpub.../0/*)

# Bitcoin Core
BTC_RPC_URL=http://127.0.0.1:8332
BTC_RPC_USER=rpcuser
BTC_RPC_PASS=rpcpass
BTC_ZMQ_TX=tcp://127.0.0.1:28332
BTC_ZMQ_BLOCK=tcp://127.0.0.1:28333
```

## CLI

```bash
# Generate database schema
npx @bitcoin-pay/cli generate

# Run migrations
npx @bitcoin-pay/cli migrate
```

## Deployment Notes

### Security

- **Never commit** your `PAY_SECRET` or RPC credentials
- Use **watch-only descriptors** only (no private keys in the SDK)
- Validate and sanitize all user inputs
- Use HTTPS in production
- Rate-limit payment creation endpoints

### Performance

- Use connection pooling for your database
- Consider Redis for rate limiting
- Monitor ZMQ connection health
- Set appropriate confirmation requirements (1-6 confs depending on amount)

### Monitoring

- Track payment intent creation rate
- Monitor watcher uptime and lag
- Alert on expired intents
- Log all state transitions for audit trail
