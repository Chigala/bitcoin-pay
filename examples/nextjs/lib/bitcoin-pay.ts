import { createBitcoinPay } from "@bitcoin-pay/core";
import type { Network } from "@bitcoin-pay/core";
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
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // Validate network
  const network = process.env.BITCOIN_NETWORK || "mainnet";
  const validNetworks = ["mainnet", "testnet", "regtest", "signet"];
  if (!validNetworks.includes(network)) {
    throw new Error(
      `Invalid BITCOIN_NETWORK: ${network}. Must be one of: ${validNetworks.join(", ")}`
    );
  }

  payInstance = createBitcoinPay({
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    baseURL: process.env.NEXT_PUBLIC_BASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    secret: process.env.BITCOIN_PAY_SECRET!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    descriptor: process.env.BITCOIN_DESCRIPTOR!,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    storage: prismaAdapter(prisma as any),
    basePath: "/api/pay",
    network: network as Network,
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

  return payInstance;
}
