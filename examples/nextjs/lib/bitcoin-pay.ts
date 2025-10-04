import { createBitcoinPay } from "@bitcoin-pay/core";
import { prismaAdapter } from "@bitcoin-pay/core/adapters/prisma";
import { prisma } from "./db";

let payInstance: ReturnType<typeof createBitcoinPay> | null = null;

export function getBitcoinPay() {
  if (payInstance) {
    return payInstance;
  }

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
    baseURL: process.env.NEXT_PUBLIC_BASE_URL as string,
    secret: process.env.BITCOIN_PAY_SECRET as string,
    descriptor: process.env.BITCOIN_DESCRIPTOR as string,
    watcher:
      process.env.BITCOIN_PAY_DISABLE_WATCHER === "1"
        ? // Provide empty config when disabled; core will no-op
          ({ zmq: {}, rpc: {} } as any)
        : {
            zmq: {
              host: process.env.BITCOIN_ZMQ_HOST || "localhost",
              hashtxPort: process.env.BITCOIN_ZMQ_TX_PORT
                ? Number.parseInt(process.env.BITCOIN_ZMQ_TX_PORT)
                : undefined,
            },
            rpc: {
              host: process.env.BITCOIN_RPC_HOST || "localhost",
              port: Number.parseInt(process.env.BITCOIN_RPC_PORT || "8332"),
              username: process.env.BITCOIN_RPC_USER as string,
              password: process.env.BITCOIN_RPC_PASS as string,
            },
          },
    // Cast to any to satisfy adapter's minimal Prisma interface
    storage: prismaAdapter(prisma as any),
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
      },
      onExpired: async ({ intentId }) => {
        console.log("[BitcoinPay] Payment expired:", intentId);
      },
      onReorg: async ({ intentId, txid }) => {
        console.log("[BitcoinPay] Reorg detected:", { intentId, txid });
      },
    },
  });

  if (process.env.BITCOIN_PAY_DISABLE_WATCHER !== "1") {
    payInstance.startWatcher().catch((error) => {
      console.error("[BitcoinPay] Failed to start watcher:", error);
    });
  }

  return payInstance;
}
