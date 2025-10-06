# Inngest Integration for Bitcoin Payments

This integration enables automatic Bitcoin payment monitoring using [Inngest](https://inngest.com) and the [Mempool.space API](https://mempool.space/docs/api).

## Features

- ✅ **No infrastructure required** - Uses public Mempool.space API
- ✅ **Scheduled polling** - Configurable check interval (default: every 5 minutes)
- ✅ **Automatic payment lifecycle** - Tracks pending → mempool → confirmed
- ✅ **Expiration handling** - Auto-expires payments after timeout
- ✅ **Type-safe events** - Full TypeScript support
- ✅ **Easy customization** - Add your own event handlers
- ✅ **Fan-out pattern** - Scales to many concurrent payments

## Installation

```bash
npm install inngest
# or
pnpm add inngest
# or
yarn add inngest
```

## Quick Start

### Option 1: With Bitcoin-Pay (Recommended)

If you're using the main `@bitcoin-pay/core` package, use the adapter bridge:

```typescript
// lib/inngest/client.ts
import { createInngestIntegration, createInngestStorageAdapter } from "@bitcoin-pay/core/integrations/inngest";
import { createBitcoinPay } from "@bitcoin-pay/core";

// Create your bitcoin-pay instance
const bitcoinPay = createBitcoinPay({
  baseURL: process.env.BASE_URL!,
  secret: process.env.SECRET!,
  descriptor: process.env.DESCRIPTOR!,
  storage: myDrizzleAdapter, // Your existing storage adapter
  network: "mainnet",
});

// Create Inngest integration using the adapter bridge
export const { inngest, functions } = createInngestIntegration({
  appId: "my-bitcoin-app",

  // Bridge your existing storage adapter
  storage: createInngestStorageAdapter(
    bitcoinPay.$context.options.storage,
    bitcoinPay.$context.options.network
  ),

  pollInterval: "*/5 * * * *", // Every 5 minutes

  onMempool: async (data) => {
    console.log("Payment in mempool:", data);
  },

  onConfirmed: async (data) => {
    console.log("Payment confirmed:", data);
  },
});
```

### Option 2: Standalone (Without Bitcoin-Pay)

Implement your own storage adapter:

```typescript
// lib/storage.ts
import { StorageAdapter, PendingPayment } from "@bitcoin-pay/core/integrations/inngest";

export const storageAdapter: StorageAdapter = {
  async getPendingPayments() {
    return await db.payments.findMany({
      where: { status: { in: ["pending", "mempool"] } },
    });
  },

  async updatePaymentStatus(paymentId, update) {
    await db.payments.update({
      where: { id: paymentId },
      data: update,
    });
  },

  async getPayment(paymentId) {
    return await db.payments.findUnique({
      where: { id: paymentId },
    });
  },
};
```

### Set Up Inngest Integration

```typescript
// lib/inngest/client.ts
import { createInngestIntegration } from "@bitcoin-pay/core/integrations/inngest";
import { storageAdapter } from "../storage";

export const { inngest, functions } = createInngestIntegration({
  appId: "my-bitcoin-app",
  storage: storageAdapter,

  // Optional: customize polling interval (cron format)
  pollInterval: "*/5 * * * *", // Every 5 minutes (default)

  // Optional: minimum confirmations (default: 1)
  confirmations: 1,

  // Optional: custom network (default: mainnet)
  mempool: {
    network: "mainnet", // or "testnet", "signet"
  },

  // Optional: custom handlers
  onMempool: async (data) => {
    console.log("Payment detected in mempool:", data);
    // Send notification, update UI, etc.
  },

  onConfirmed: async (data) => {
    console.log("Payment confirmed:", data);
    // Fulfill order, send confirmation email, etc.
  },

  onExpired: async (data) => {
    console.log("Payment expired:", data);
    // Cancel order, notify user, etc.
  },
});
```

### 3. Create Inngest API Route (Next.js App Router)

```typescript
// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest, functions } from "@/lib/inngest/client";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions, // All payment monitoring functions included here
});
```

### 4. Start Inngest Dev Server

```bash
npx inngest-cli@latest dev
```

Open [http://localhost:8288](http://localhost:8288) to see the Inngest dashboard.

### 5. Create a Payment

```typescript
// app/api/create-payment/route.ts
import { createPayment } from "@bitcoin-pay/core";
import { inngest } from "@/lib/inngest/client";

export async function POST(req: Request) {
  const { amount, expiresInMinutes } = await req.json();

  // Create payment using bitcoin-pay
  const payment = await createPayment({
    amount,
    network: "mainnet",
  });

  // Store in database
  await db.payments.create({
    data: {
      id: payment.id,
      address: payment.address,
      amount: payment.amount,
      status: "pending",
      expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
      network: "mainnet",
    },
  });

  // Optional: trigger immediate check (instead of waiting for scheduled poll)
  await inngest.send({
    name: "bitcoin/payment.check",
    data: {
      paymentId: payment.id,
      address: payment.address,
      expectedAmount: payment.amount,
      expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
      network: "mainnet",
    },
  });

  return Response.json(payment);
}
```

## Configuration Options

### Poll Interval

Customize how often to check for pending payments:

```typescript
createInngestIntegration({
  // ... other config
  pollInterval: "*/1 * * * *",  // Every minute (faster, more API calls)
  pollInterval: "*/10 * * * *", // Every 10 minutes (slower, fewer API calls)
  pollInterval: "0 * * * *",    // Every hour
});
```

### Network Selection

```typescript
createInngestIntegration({
  // ... other config
  mempool: {
    network: "testnet", // Use testnet API
  },
});
```

### Custom Mempool Instance

If you're running your own Mempool.space instance:

```typescript
createInngestIntegration({
  // ... other config
  mempool: {
    apiUrl: "https://my-mempool-instance.com/api",
  },
});
```

### Required Confirmations

```typescript
createInngestIntegration({
  // ... other config
  confirmations: 3, // Wait for 3 confirmations before marking as confirmed
});
```

## Event Types

The integration emits the following typed events:

### `bitcoin/payment.check`
Triggered by the scheduler to check a payment's status.

```typescript
{
  paymentId: string;
  address: string;
  expectedAmount: number;
  expiresAt: number;
  network: "mainnet" | "testnet" | "regtest" | "signet";
}
```

### `bitcoin/payment.mempool`
Triggered when a payment is detected in the mempool.

```typescript
{
  paymentId: string;
  txid: string;
  amount: number;
  address: string;
}
```

### `bitcoin/payment.confirmed`
Triggered when a payment reaches required confirmations.

```typescript
{
  paymentId: string;
  txid: string;
  confirmations: number;
  amount: number;
  address: string;
}
```

### `bitcoin/payment.expired`
Triggered when a payment expires before being paid.

```typescript
{
  paymentId: string;
  address: string;
}
```

## Advanced: Custom Event Handlers

You can create your own Inngest functions that listen to payment events:

```typescript
// lib/inngest/custom-functions.ts
import { inngest } from "./client";

export const sendEmailOnMempool = inngest.createFunction(
  { id: "send-email-on-mempool" },
  { event: "bitcoin/payment.mempool" },
  async ({ event, step }) => {
    const { paymentId, txid } = event.data;

    await step.run("send-email", async () => {
      await sendEmail({
        to: await getUserEmail(paymentId),
        subject: "Payment Received!",
        body: `Your payment has been detected: ${txid}`,
      });
    });
  }
);

export const fulfillOrderOnConfirmation = inngest.createFunction(
  { id: "fulfill-order" },
  { event: "bitcoin/payment.confirmed" },
  async ({ event, step }) => {
    const { paymentId } = event.data;

    const order = await step.run("get-order", async () => {
      return await db.orders.findUnique({ where: { paymentId } });
    });

    await step.run("fulfill", async () => {
      await fulfillOrder(order.id);
    });
  }
);
```

Then add them to your API route:

```typescript
// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest, functions } from "@/lib/inngest/client";
import { sendEmailOnMempool, fulfillOrderOnConfirmation } from "@/lib/inngest/custom-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ...functions,
    sendEmailOnMempool,
    fulfillOrderOnConfirmation,
  ],
});
```

## Manual Payment Check

Trigger a manual payment check without waiting for the scheduled poll:

```typescript
import { inngest } from "@/lib/inngest/client";

await inngest.send({
  name: "bitcoin/payment.check",
  data: {
    paymentId: "payment_123",
    address: "bc1q...",
    expectedAmount: 100000, // satoshis
    expiresAt: Date.now() + 3600000, // 1 hour from now
    network: "mainnet",
  },
});
```

Or use the helper:

```typescript
import { triggerPaymentCheck } from "@/lib/inngest/client";

await triggerPaymentCheck("payment_123");
```

## Deployment

### Inngest Cloud (Recommended)

1. Sign up at [inngest.com](https://inngest.com)
2. Get your event key
3. Add to environment variables:
   ```bash
   INNGEST_EVENT_KEY=your_event_key
   ```
4. Update your integration:
   ```typescript
   createInngestIntegration({
     // ... other config
     eventKey: process.env.INNGEST_EVENT_KEY,
   });
   ```
5. Deploy your Next.js app as usual

### Self-Hosted

If you prefer to self-host, follow [Inngest's self-hosting guide](https://www.inngest.com/docs/self-hosting).

## API Rate Limits

Mempool.space has rate limits on their public API. If you're processing many payments:

1. **Increase poll interval** - Use `*/10 * * * *` instead of `*/5 * * * *`
2. **Run your own Mempool instance** - Full control over rate limits
3. **Use Inngest's built-in retries** - Automatically handles temporary failures

## Comparison with ZMQ

| Feature | Inngest + Mempool.space | ZMQ + Bitcoin Core |
|---------|-------------------------|---------------------|
| Setup complexity | ⭐ Very easy | ⭐⭐⭐ Complex |
| Infrastructure | None required | Bitcoin full node + ZMQ |
| Real-time updates | ~5 min delay | Instant |
| Cost | Free (public API) | Node hosting costs |
| Reliability | High (managed) | Depends on your setup |
| Best for | Most use cases | High-frequency, real-time needs |

## Support

For issues or questions:
- **Inngest**: [Inngest Discord](https://www.inngest.com/discord)
- **Bitcoin-Pay**: [GitHub Issues](https://github.com/bitcoin-pay/bitcoin-pay/issues)
- **Mempool.space**: [Mempool Docs](https://mempool.space/docs)
