import {
  createInngestIntegration,
  createInngestStorageAdapter,
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
  pollInterval: process.env.INNGEST_POLL_INTERVAL || "*/10 * * * *",

  // Minimum confirmations (default: 1)
  confirmations: Number(process.env.BITCOIN_CONFIRMATIONS) || 1,

  // Network configuration (use the same network as bitcoin-pay)
  // Note: regtest requires a custom apiUrl for local mempool.space instance
  mempool: network === "regtest"
    ? { apiUrl: process.env.MEMPOOL_API_URL || "http://localhost:8080/api" }
    : { network },

  // Event key for Inngest Cloud (optional, not needed for dev server)
  eventKey: process.env.INNGEST_EVENT_KEY,

  // Custom handlers - types are automatically inferred from InngestIntegrationConfig
  onMempool: async (data) => {
    console.log("[Inngest] Payment detected in mempool:", {
      paymentId: data.paymentId,
      txid: data.txid,
      amount: data.amount,
      address: data.address,
    });
  },

  onConfirmed: async (data) => {
    console.log("[Inngest] Payment confirmed:", {
      paymentId: data.paymentId,
      txid: data.txid,
      confirmations: data.confirmations,
      amount: data.amount,
      address: data.address,
    });
  },

  onExpired: async (data) => {
    console.log("[Inngest] Payment expired:", {
      paymentId: data.paymentId,
      address: data.address,
    });
  },

  // Subscription event handlers - types are automatically inferred
  subscriptions: {
    renewalCron: "0 0 * * *", // Check daily at midnight
    gracePeriodDays: 3,

    onRenewalCreated: async (data) => {
      console.log("[Inngest] Subscription renewal created:", {
        subscriptionId: data.subscriptionId,
        planId: data.planId,
        customerId: data.customerId,
        paymentIntentId: data.paymentIntentId,
        amount: data.amount,
        cycleNumber: data.cycleNumber,
      });

      // TODO: Send email notification to customer about upcoming payment
      // Example: await sendEmail(data.customerId, "Subscription Renewal", ...)
    },

    onRenewalPaid: async (data) => {
      console.log("[Inngest] Subscription payment received:", {
        subscriptionId: data.subscriptionId,
        txid: data.txid,
        amount: data.amount,
        cycleNumber: data.cycleNumber,
      });

      // TODO: Extend customer's access for another billing cycle
      // Example: await updateUserAccess(data.customerId, data.currentPeriodEnd)
    },

    onPastDue: async (data) => {
      console.log("[Inngest] Subscription payment past due:", {
        subscriptionId: data.subscriptionId,
        paymentIntentId: data.paymentIntentId,
        daysPastDue: data.daysPastDue,
      });

      // TODO: Send payment reminder email
      // Example: await sendEmail(data.customerId, "Payment Reminder", ...)
    },

    onCanceled: async (data) => {
      console.log("[Inngest] Subscription canceled:", {
        subscriptionId: data.subscriptionId,
        planId: data.planId,
        reason: data.reason,
      });

      // TODO: Handle subscription cancellation
      // Example: await revokeUserAccess(data.customerId)
    },

    onExpired: async (data) => {
      console.log("[Inngest] Subscription expired:", {
        subscriptionId: data.subscriptionId,
        planId: data.planId,
        reason: data.reason,
      });

      // TODO: Revoke customer access
      // Example: await revokeUserAccess(data.customerId)
    },
  },
});
