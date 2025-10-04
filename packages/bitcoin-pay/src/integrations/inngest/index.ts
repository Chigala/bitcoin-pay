/**
 * Inngest integration for Bitcoin payment monitoring
 *
 * This integration uses Mempool.space API to monitor Bitcoin payments without
 * requiring ZMQ or a local Bitcoin RPC node.
 *
 * @example
 * ```typescript
 * import { createInngestIntegration } from "bitcoin-pay/integrations/inngest";
 *
 * export const { inngest, functions } = createInngestIntegration({
 *   appId: "my-bitcoin-app",
 *   storage: myStorageAdapter,
 *   pollInterval: "star/5 star star star star", // Every 5 minutes (replace star with *)
 *   onMempool: async (data) => {
 *     console.log("Payment in mempool:", data);
 *   },
 *   onConfirmed: async (data) => {
 *     console.log("Payment confirmed:", data);
 *   },
 * });
 *
 * // In your Next.js API route:
 * // app/api/inngest/route.ts
 * import { serve } from "inngest/next";
 * import { inngest, functions } from "./inngest/client";
 *
 * export const { GET, POST, PUT } = serve({
 *   client: inngest,
 *   functions,
 * });
 * ```
 */

import { createBitcoinPaymentClient } from "./client.js";
import { createPaymentWatcher } from "./functions.js";
import { MempoolClient } from "./mempool-client.js";
import type { InngestIntegrationConfig, PaymentEvents } from "./types.js";

export type {
  InngestIntegrationConfig,
  PaymentEvents,
  StorageAdapter,
  PendingPayment,
  MempoolConfig,
  PaymentStatus,
} from "./types.js";

/**
 * Event context type for event-triggered functions
 */
interface EventContext<T extends keyof PaymentEvents> {
  event: {
    name: T;
    data: PaymentEvents[T]["data"];
  };
}

export { MempoolClient } from "./mempool-client.js";

/**
 * Create Inngest integration for Bitcoin payment monitoring
 *
 * This function sets up all necessary Inngest functions for monitoring Bitcoin
 * payments using the Mempool.space API. It returns an Inngest client and an
 * array of functions that should be passed to the `serve()` handler.
 */
export function createInngestIntegration(config: InngestIntegrationConfig) {
  // Create Inngest client
  const inngest = createBitcoinPaymentClient({
    id: config.appId,
    eventKey: config.eventKey,
  });

  // Create Mempool.space API client
  const mempoolClient = new MempoolClient(config.mempool);

  // Create core payment watcher functions
  const watcherFunctions = createPaymentWatcher({
    inngest,
    storage: config.storage,
    mempoolClient,
    pollInterval: config.pollInterval || "*/5 * * * *",
    confirmations: config.confirmations || 1,
  });

  // Build functions array (using unknown[] since Inngest function types are complex generics)
  const allFunctions: unknown[] = [
    watcherFunctions.checkPendingPayments,
    watcherFunctions.checkPayment,
    watcherFunctions.handleMempool,
    watcherFunctions.handleConfirmed,
    watcherFunctions.handleExpired,
  ];

  // Add custom user handlers if provided
  if (config.onMempool) {
    const userMempoolHandler = inngest.createFunction(
      { id: "user-mempool-handler" },
      { event: "bitcoin/payment.mempool" },
      async ({ event }: EventContext<"bitcoin/payment.mempool">) => {
        await config.onMempool?.(event.data);
      }
    );
    allFunctions.push(userMempoolHandler);
  }

  if (config.onConfirmed) {
    const userConfirmedHandler = inngest.createFunction(
      { id: "user-confirmed-handler" },
      { event: "bitcoin/payment.confirmed" },
      async ({ event }: EventContext<"bitcoin/payment.confirmed">) => {
        await config.onConfirmed?.(event.data);
      }
    );
    allFunctions.push(userConfirmedHandler);
  }

  if (config.onExpired) {
    const userExpiredHandler = inngest.createFunction(
      { id: "user-expired-handler" },
      { event: "bitcoin/payment.expired" },
      async ({ event }: EventContext<"bitcoin/payment.expired">) => {
        await config.onExpired?.(event.data);
      }
    );
    allFunctions.push(userExpiredHandler);
  }

  return {
    /**
     * Inngest client instance - use this to send events
     */
    inngest,

    /**
     * Array of all Inngest functions - pass this to serve()
     */
    functions: allFunctions,

    /**
     * Mempool.space API client - use this to manually check payment status
     */
    mempoolClient,

    /**
     * Helper to manually trigger a payment check
     */
    triggerPaymentCheck: async (paymentId: string) => {
      const payment = await config.storage.getPayment(paymentId);
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      await inngest.send({
        name: "bitcoin/payment.check",
        data: {
          paymentId: payment.id,
          address: payment.address,
          expectedAmount: payment.amount,
          expiresAt: payment.expiresAt,
          network: payment.network,
        },
      });
    },
  };
}
