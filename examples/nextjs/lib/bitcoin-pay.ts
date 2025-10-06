import { createBitcoinPay } from "@bitcoin-pay/core";
import type { Network } from "@bitcoin-pay/core";
import { prismaAdapter } from "@bitcoin-pay/core/adapters/prisma";
import { prisma } from "./db";

let payInstance: ReturnType<typeof createBitcoinPay> | null = null;

export function getBitcoinPay() {
  if (payInstance) {
    return payInstance;
  }

  // Validate required environment variables
  const baseURL = process.env.NEXT_PUBLIC_BASE_URL;
  const secret = process.env.BITCOIN_PAY_SECRET;
  const descriptor = process.env.BITCOIN_DESCRIPTOR;

  if (!baseURL) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_BASE_URL");
  }
  if (!secret) {
    throw new Error("Missing required environment variable: BITCOIN_PAY_SECRET");
  }
  if (!descriptor) {
    throw new Error("Missing required environment variable: BITCOIN_DESCRIPTOR");
  }

  // Validate network
  const network = process.env.BITCOIN_NETWORK || "mainnet";
  const validNetworks = ["mainnet", "testnet", "regtest", "signet"] as const;
  if (!validNetworks.includes(network as Network)) {
    throw new Error(
      `Invalid BITCOIN_NETWORK: ${network}. Must be one of: ${validNetworks.join(", ")}`
    );
  }

  payInstance = createBitcoinPay({
    baseURL,
    secret,
    descriptor,
    // @ts-expect-error - Prisma types are generated and may not match exactly at build time
    storage: prismaAdapter(prisma),
    basePath: "/api/pay",
    network: network as Network,

    // Subscription configuration
    subscriptions: {
      plans: [
        {
          id: 'premium-monthly',
          name: 'Premium Monthly',
          description: 'Monthly premium subscription with Bitcoin',
          amountSats: 100000, // 0.001 BTC
          interval: 'monthly',
        },
        {
          id: 'premium-yearly',
          name: 'Premium Yearly',
          description: 'Yearly premium subscription - Save 17%',
          amountSats: 1000000, // 0.01 BTC
          interval: 'yearly',
        },
        {
          id: 'pro-monthly',
          name: 'Pro Monthly',
          description: 'Pro tier with advanced features',
          amountSats: 250000, // 0.0025 BTC
          interval: 'monthly',
        },
      ],
      autoSync: true,
      gracePeriodDays: 3,
    },

    // Event handlers - types are automatically inferred from BitcoinPayOptions
    events: {
      onIntentCreated: async (data) => {
        console.log("[BitcoinPay] Payment intent created:", data.intentId);
      },
      onProcessing: async (data) => {
        console.log("[BitcoinPay] Payment processing:", {
          intentId: data.intentId,
          txid: data.txid,
          valueSats: data.valueSats,
        });
      },
      onConfirmed: async (data) => {
        console.log("[BitcoinPay] Payment confirmed:", {
          intentId: data.intentId,
          txid: data.txid,
          valueSats: data.valueSats,
          confirmations: data.confirmations,
        });
      },
      onExpired: async (data) => {
        console.log("[BitcoinPay] Payment expired:", data.intentId);
      },
      onReorg: async (data) => {
        console.log("[BitcoinPay] Reorg detected:", {
          intentId: data.intentId,
          txid: data.txid
        });
      },
    },
  });

  return payInstance;
}
