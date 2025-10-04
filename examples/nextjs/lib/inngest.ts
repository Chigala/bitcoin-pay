import {
  createInngestIntegration,
  createInngestStorageAdapter,
  type PaymentEvents,
} from "@bitcoin-pay/core/integrations/inngest";
import { getBitcoinPay } from "./bitcoin-pay";

const bitcoinPay = getBitcoinPay();

// Get network from bitcoin-pay context (already validated)
const network = bitcoinPay.$context.options.network;

export const { inngest, functions } = createInngestIntegration({
  appId: "bitcoin-pay-example",

  // Bridge the bitcoin-pay storage adapter to work with Inngest
  storage: createInngestStorageAdapter(
    bitcoinPay.$context.options.storage,
    network
  ),

  // Poll every 5 minutes (customize as needed)
  // "*/1 * * * *" for every minute
  // "*/10 * * * *" for every 10 minutes
  pollInterval: process.env.INNGEST_POLL_INTERVAL || "*/5 * * * *",

  // Minimum confirmations (default: 1)
  confirmations: Number(process.env.BITCOIN_CONFIRMATIONS) || 1,

  // Network configuration (use the same network as bitcoin-pay)
  // Note: regtest requires a custom apiUrl for local mempool.space instance
  mempool: network === "regtest"
    ? { apiUrl: process.env.MEMPOOL_API_URL || "http://localhost:8080/api" }
    : { network },

  // Event key for Inngest Cloud (optional, not needed for dev server)
  eventKey: process.env.INNGEST_EVENT_KEY,

  // Custom handlers (called in addition to bitcoin-pay's event handlers)
  onMempool: async (data: PaymentEvents["bitcoin/payment.mempool"]["data"]) => {
    console.log("[Inngest] Payment detected in mempool:", {
      paymentId: data.paymentId,
      txid: data.txid,
      amount: data.amount,
      address: data.address,
    });
  },

  onConfirmed: async (data: PaymentEvents["bitcoin/payment.confirmed"]["data"]) => {
    console.log("[Inngest] Payment confirmed:", {
      paymentId: data.paymentId,
      txid: data.txid,
      confirmations: data.confirmations,
      amount: data.amount,
      address: data.address,
    });
  },

  onExpired: async (data: PaymentEvents["bitcoin/payment.expired"]["data"]) => {
    console.log("[Inngest] Payment expired:", {
      paymentId: data.paymentId,
      address: data.address,
    });
  },
});
