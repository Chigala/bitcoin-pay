# Bitcoin Pay Next.js Example - Setup Guide

This guide will help you set up and test the Bitcoin Pay SDK with a local Postgres database.

## Prerequisites

- Node.js 18+ and pnpm installed
- Docker (for running Postgres locally)
- Bitcoin Core (optional, for full testing)

## Step 1: Start Local Postgres Database

Run a Postgres database using Docker:

```bash
docker run --name bitcoin-pay-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bitcoin_pay_dev \
  -p 5432:5432 \
  -d postgres:16
```

## Step 2: Install Dependencies

From the root of the monorepo:

```bash
pnpm install
```

## Step 3: Set Up Environment Variables

Copy the example env file:

```bash
cd examples/nextjs
cp .env.example .env
```

Update `.env` with your values (the defaults should work for local testing).

## Step 4: Generate Prisma Client & Push Schema

```bash
pnpm prisma:generate
pnpm db:push
```

This will:

- Generate the Prisma Client
- Create all bitcoin-pay tables in your database
- Create simple auth and todo tables (`app_users`, `app_password_credentials`, `app_sessions`, `app_todos`)

## Step 5: Run the Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

## Step 6: Test the Payment Flow

### Without Bitcoin Core (UI Testing Only)

1. Go to http://localhost:3000
2. Enter an email, amount (e.g., 50000 sats), and memo
3. Click "Create Payment Link"
4. Copy the magic link and open it in a new tab
5. You'll see the payment page with a Bitcoin address and QR code

Note: Without Bitcoin Core running, actual payment detection won't work.

### With Bitcoin Core (Full Testing)

1. Install and run Bitcoin Core in regtest mode:

```bash
bitcoind -regtest \
  -rpcuser=bitcoinrpc \
  -rpcpassword=your-rpc-password \
  -zmqpubrawtx=tcp://127.0.0.1:28332 \
  -zmqpubhashblock=tcp://127.0.0.1:28333
```

2. Update your `.env` with the RPC credentials

3. Generate a descriptor wallet and import the descriptor from `.env`

4. Create a payment intent and send Bitcoin to the address

5. Watch the payment status update in real-time!

## Database Management

### View Database

```bash
pnpm db:studio
```

This opens Prisma Studio at http://localhost:5555 where you can view and edit your database.

### Reset Database

```bash
pnpm db:push --force-reset
```

## Troubleshooting

### Prisma Client Not Found

Run:

```bash
pnpm prisma:generate
```

### Database Connection Error

Make sure Postgres is running:

```bash
docker ps | grep bitcoin-pay-postgres
```

### Port Already in Use

Change the port in the docker command or stop the existing container:

```bash
docker stop bitcoin-pay-postgres
docker rm bitcoin-pay-postgres
```

## Architecture

- **Next.js 14** with App Router
- **Prisma** for database ORM
- **Postgres** for data storage
- **Bitcoin Pay SDK** for payment processing
- **React hooks** for payment UI (`usePaymentInit`, `usePaymentStatus`, etc.)

## API Endpoints

- `POST /api/pay/intents` - Create payment intent
- `POST /api/pay/intents/:id/magic-link` - Generate magic link
- `GET /api/pay/pay/:token` - Initialize payment from magic link
- `GET /api/pay/status?intentId=xxx` - Get payment status

## Next Steps

- Customize the payment page UI
- Add webhooks for payment notifications
- Integrate with your own authentication
- Deploy to production with a real Bitcoin node
