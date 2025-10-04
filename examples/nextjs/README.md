# Bitcoin Pay Next.js Example

This example demonstrates how to integrate Bitcoin Pay into a Next.js application.

## Features

- Payment intent creation API
- Magic link payment pages
- Real-time payment status updates
- QR code generation
- Countdown timer
- Responsive UI

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables (`.env.local`):
   ```env
   # Base URL
   NEXT_PUBLIC_BASE_URL=http://localhost:3000

   # Bitcoin Pay Secret (generate with: openssl rand -hex 32)
   BITCOIN_PAY_SECRET=your-secret-here

   # Bitcoin Descriptor (watch-only xpub)
   BITCOIN_DESCRIPTOR=wpkh([fingerprint/84'/0'/0']xpub...)

   # Bitcoin Core ZMQ
   BITCOIN_ZMQ_HOST=localhost
   BITCOIN_ZMQ_TX_PORT=28332

   # Bitcoin Core RPC
   BITCOIN_RPC_HOST=localhost
   BITCOIN_RPC_PORT=8332
   BITCOIN_RPC_USER=your-rpc-user
   BITCOIN_RPC_PASS=your-rpc-password

   # Database
   DATABASE_URL=postgresql://user:pass@localhost:5432/bitcoin_pay
   ```

3. Run migrations:
   ```bash
   pnpm db:migrate
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

## Usage

### Create a payment intent

```typescript
const response = await fetch('/api/pay/intents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'customer@example.com',
    amountSats: 50000,
    memo: 'Premium subscription',
  }),
});

const intent = await response.json();
```

### Create a magic link

```typescript
const response = await fetch(`/api/pay/intents/${intent.id}/magic-link`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ttlHours: 24,
  }),
});

const { url } = await response.json();
// Send this URL to the customer via email
```

### Payment page

The payment page at `/pay/[token]` handles:
- Displaying payment amount
- Generating QR code
- Showing Bitcoin address
- Real-time status updates
- Countdown timer
- Payment confirmation

## API Routes

- `POST /api/pay/intents` - Create payment intent
- `POST /api/pay/intents/:id/magic-link` - Create magic link
- `GET /api/pay/pay/:token` - Initialize payment from magic link
- `GET /api/pay/status?intentId=xxx` - Get payment status
- `POST /api/pay/scan/:intentId` - Manually trigger blockchain scan

## Learn More

- [Bitcoin Pay Documentation](../../README.md)
- [Next.js Documentation](https://nextjs.org/docs)
