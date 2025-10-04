import express from "express";
import { createBitcoinPay } from "@bitcoin-pay/core";
import { drizzleAdapter } from "@bitcoin-pay/core/adapters/drizzle-adapter";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Database setup
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

// Initialize Bitcoin Pay
const pay = createBitcoinPay({
	baseURL: process.env.BASE_URL!,
	secret: process.env.BITCOIN_PAY_SECRET!,
	descriptor: process.env.BITCOIN_DESCRIPTOR!,
	watcher: {
		zmq: {
			host: process.env.BITCOIN_ZMQ_HOST || "localhost",
			hashtxPort: parseInt(process.env.BITCOIN_ZMQ_TX_PORT || "28332"),
		},
		rpc: {
			host: process.env.BITCOIN_RPC_HOST || "localhost",
			port: parseInt(process.env.BITCOIN_RPC_PORT || "8332"),
			username: process.env.BITCOIN_RPC_USER!,
			password: process.env.BITCOIN_RPC_PASS!,
		},
	},
	storage: drizzleAdapter(db, { provider: "pg" }),
	basePath: "/api/pay",
	events: {
		onIntentCreated: async ({ intentId }) => {
			console.log("Payment intent created:", intentId);
		},
		onProcessing: async ({ intentId, txid }) => {
			console.log("Payment processing:", intentId, txid);
		},
		onConfirmed: async ({ intentId, txid }) => {
			console.log("Payment confirmed:", intentId, txid);
		},
	},
});

// Start watcher
pay.startWatcher().catch(console.error);

// Create Express app
const app = express();
app.use(express.json());

// Mount Bitcoin Pay handler
app.all("/api/pay/*", async (req, res) => {
	const url = new URL(req.url, `${req.protocol}://${req.get("host")}`);
	const request = new Request(url, {
		method: req.method,
		headers: req.headers as HeadersInit,
		body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
	});

	const response = await pay.handler(request);
	const body = await response.text();

	res.status(response.status);
	response.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});
	res.send(body);
});

// Example: Create payment endpoint
app.post("/checkout", async (req, res) => {
	const { email, amount, memo } = req.body;

	// Create payment intent
	const intent = await pay.createPaymentIntent({
		email,
		amountSats: amount,
		memo,
	});

	// Create magic link
	const { url } = await pay.createMagicLink({
		intentId: intent.id,
		ttlHours: 24,
	});

	res.json({
		intentId: intent.id,
		paymentUrl: url,
		expiresAt: intent.expiresAt,
	});
});

// Health check
app.get("/health", (req, res) => {
	res.json({ status: "ok", watcher: pay.$context.watcherStarted });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("SIGTERM received, shutting down gracefully...");
	await pay.stopWatcher();
	await client.end();
	process.exit(0);
});
