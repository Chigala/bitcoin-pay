# Bitcoin Pay Next.js - Quick Start Guide

## Complete Project Structure

```
nextjs/
├── app/
│   ├── api/
│   │   └── pay/
│   │       └── [...path]/
│   │           └── route.ts          # Bitcoin Pay API handler
│   ├── pay/
│   │   └── [token]/
│   │       └── page.tsx               # Payment page
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Home page (demo form)
│   └── globals.css                    # Global styles
├── lib/
│   ├── bitcoin-pay.ts                 # Bitcoin Pay singleton
│   └── db.ts                          # Database connection
├── prisma/
│   └── schema.prisma                  # Prisma schema for DB
├── .env.local                         # Your environment variables
├── .env.example                       # Template for env vars
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── package.json
```

## Setup Steps

### 1. Install Dependencies

```bash
cd examples/nextjs
pnpm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Bitcoin Pay Secret (generate with: openssl rand -hex 32)
BITCOIN_PAY_SECRET=abc123...

# Bitcoin Descriptor (get from: bitcoin-cli listdescriptors)
BITCOIN_DESCRIPTOR=wpkh([fingerprint/84'/0'/0']xpub...)

# Bitcoin Core ZMQ (add to bitcoin.conf: zmqpubrawtx=tcp://127.0.0.1:28332)
BITCOIN_ZMQ_HOST=localhost
BITCOIN_ZMQ_TX_PORT=28332

# Bitcoin Core RPC (from bitcoin.conf or .cookie file)
BITCOIN_RPC_HOST=localhost
BITCOIN_RPC_PORT=8332
BITCOIN_RPC_USER=your-rpc-user
BITCOIN_RPC_PASS=your-rpc-password

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bitcoin_pay
```

### 3. Set Up Bitcoin Core

Add to your `bitcoin.conf`:

```conf
# Enable ZMQ for transaction notifications
zmqpubrawtx=tcp://127.0.0.1:28332
zmqpubhashblock=tcp://127.0.0.1:28333

# Enable RPC
server=1
rpcuser=your-rpc-user
rpcpassword=your-rpc-password
rpcallowip=127.0.0.1

# Use testnet for testing
testnet=1
```

Restart Bitcoin Core after adding these settings.

### 4. Create Database

```bash
# Create PostgreSQL database
createdb bitcoin_pay

# Or with psql
psql -c "CREATE DATABASE bitcoin_pay;"
```

### 5. Run Migrations

```bash
pnpm prisma:generate
pnpm db:migrate
```

This creates all required tables (bitcoin-pay + auth/todo models):

- `bitcoin_pay_payment_intents`
- `bitcoin_pay_deposit_addresses`
- `bitcoin_pay_tx_observations`
- `bitcoin_pay_magic_link_tokens`
- `bitcoin_pay_customers`
- `app_users`
- `app_password_credentials`
- `app_sessions`
- `app_todos`

### 6. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Create a Payment

1. Go to http://localhost:3000
2. Fill in the form:
   - Email (optional)
   - Amount in sats (e.g., 50000)
   - Memo (optional)
3. Click "Create Payment Link"
4. Copy the magic link or open it directly

### Test a Payment

1. Open the payment link
2. Scan the QR code with a Bitcoin wallet
3. Send the exact amount
4. Watch the status update automatically:
   - Pending → Processing (mempool)
   - Processing → Confirmed (after N confirmations)

## API Endpoints

All endpoints are available at `/api/pay/*`:

### Create Payment Intent

```typescript
POST /api/pay/intents
Content-Type: application/json

{
  "email": "customer@example.com",
  "amountSats": 50000,
  "memo": "Premium subscription"
}

Response:
{
  "id": "intent_abc123",
  "amountSats": 50000,
  "status": "pending",
  "expiresAt": "2024-10-05T12:00:00Z",
  ...
}
```

### Create Magic Link

```typescript
POST /api/pay/intents/:id/magic-link
Content-Type: application/json

{
  "ttlHours": 24
}

Response:
{
  "url": "http://localhost:3000/pay/abc123.def456",
  "token": "abc123.def456"
}
```

### Get Payment Status

```typescript
GET /api/pay/status?intentId=intent_abc123

Response:
{
  "status": "confirmed",
  "amountSats": 50000,
  "confs": 6,
  "txid": "abc123...",
  "valueSats": 50000
}
```

## File Descriptions

### `lib/bitcoin-pay.ts`

Singleton instance of Bitcoin Pay SDK. Handles:

- Configuration from environment variables
- Database adapter setup
- Watcher initialization
- Event callbacks

### `lib/db.ts`

Database connection using Prisma Client with PostgreSQL.

### `app/api/pay/[...path]/route.ts`

Catch-all route handler that forwards all `/api/pay/*` requests to the Bitcoin Pay SDK handler.

### `app/pay/[token]/page.tsx`

Payment page component using React hooks:

- Displays payment amount and QR code
- Shows countdown timer
- Polls payment status every 3 seconds
- Updates UI automatically when payment is detected/confirmed

### `app/page.tsx`

Demo homepage with a form to create payment links.

### `prisma/schema.prisma`

Prisma schema defining both bitcoin-pay models and a simple auth/todo app.

## Troubleshooting

### ZMQ Connection Error

Make sure Bitcoin Core is running with ZMQ enabled:

```bash
bitcoin-cli getzmqnotifications
```

Should show:

```json
[
  {
    "type": "pubrawtx",
    "address": "tcp://127.0.0.1:28332"
  }
]
```

### RPC Authentication Error

Check your RPC credentials in `bitcoin.conf` or `.cookie` file.

### Database Connection Error

Make sure PostgreSQL is running and the DATABASE_URL is correct:

```bash
psql $DATABASE_URL -c "SELECT version();"
```

### Watcher Not Starting

Check the server logs for errors. The watcher starts automatically when the Next.js server starts.

## Production Deployment

For production:

1. Use a production Bitcoin node (not testnet)
2. Set up proper environment variables
3. Use a production PostgreSQL database
4. Enable HTTPS
5. Set up proper logging and monitoring
6. Consider using a process manager for the watcher
7. Set up webhook endpoints for payment notifications

## Learn More

- [Bitcoin Pay Documentation](../../README.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
