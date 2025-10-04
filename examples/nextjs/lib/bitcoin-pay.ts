import { createBitcoinPay } from "@bitcoin-pay/core";
import { drizzleAdapter } from "@bitcoin-pay/core/adapters/drizzle-adapter";
import { db } from "./db";

// Singleton instance
let payInstance: ReturnType<typeof createBitcoinPay> | null = null;

export function getBitcoinPay() {
	if (payInstance) {
		return payInstance;
	}

	// Validate required environment variables
	const required = [
		"NEXT_PUBLIC_BASE_URL",
		"BITCOIN_PAY_SECRET",
		"BITCOIN_DESCRIPTOR",
		"BITCOIN_RPC_USER",
		"BITCOIN_RPC_PASS",
	];

	for (const key of required) {
		if (!process.env[key]) {
			throw new Error(`Missing required environment variable: ${key}`);
		}
	}

	payInstance = createBitcoinPay({
		baseURL: process.env.NEXT_PUBLIC_BASE_URL!,
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
				console.log("[BitcoinPay] Payment intent created:", intentId);
			},
			onProcessing: async ({ intentId, txid, valueSats }) => {
				console.log("[BitcoinPay] Payment processing:", {
					intentId,
					txid,
					valueSats,
				});
			},
			onConfirmed: async ({ intentId, txid, valueSats, confirmations }) => {
				console.log("[BitcoinPay] Payment confirmed:", {
					intentId,
					txid,
					valueSats,
					confirmations,
				});
				// You can add webhook calls, email notifications, etc. here
			},
			onExpired: async ({ intentId }) => {
				console.log("[BitcoinPay] Payment expired:", intentId);
			},
			onReorg: async ({ intentId, txid }) => {
				console.log("[BitcoinPay] Reorg detected:", { intentId, txid });
			},
		},
	});

	// Start watcher
	payInstance.startWatcher().catch((error) => {
		console.error("[BitcoinPay] Failed to start watcher:", error);
	});

	return payInstance;
}
