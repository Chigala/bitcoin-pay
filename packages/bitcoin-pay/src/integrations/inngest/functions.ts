/**
 * Inngest functions for monitoring Bitcoin payments
 */

import type { Inngest } from "inngest";
import type { StorageAdapter, PaymentEvents, PendingPayment } from "./types.js";
import type { MempoolClient } from "./mempool-client.js";

export interface WatcherConfig {
  inngest: Inngest;
  storage: StorageAdapter;
  mempoolClient: MempoolClient;
  pollInterval: string;
  confirmations: number;
}

/**
 * Inngest step utilities type
 */
interface InngestStep {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
  sendEvent(id: string, events: PaymentEvent | PaymentEvent[]): Promise<void>;
}

/**
 * Inngest event handler context for cron-triggered functions
 */
interface CronContext {
  step: InngestStep;
}

/**
 * Inngest event handler context for event-triggered functions
 */
interface EventContext<T extends keyof PaymentEvents> {
  event: {
    name: T;
    data: PaymentEvents[T]["data"];
  };
  step: InngestStep;
}

/**
 * Type for payment events that can be sent
 */
type PaymentEvent = {
  [K in keyof PaymentEvents]: {
    name: K;
    data: PaymentEvents[K]["data"];
  };
}[keyof PaymentEvents];

/**
 * Create all payment watcher functions
 */
export function createPaymentWatcher(config: WatcherConfig) {
  const { inngest, storage, mempoolClient, pollInterval, confirmations } =
    config;

  /**
   * Scheduled function that runs periodically to check all pending payments
   * This is the "fan-out" scheduler
   */
  const checkPendingPayments = inngest.createFunction(
    { id: "bitcoin-check-pending-payments" },
    { cron: pollInterval },
    async ({ step }: CronContext) => {
      // Load all pending payments from storage
      const pending = await step.run("load-pending-payments", async () => {
        return await storage.getPendingPayments();
      });

      if (pending.length === 0) {
        return { message: "No pending payments to check", count: 0 };
      }

      // Fan-out: send individual check event for each payment
      const events = pending.map((payment: PendingPayment) => ({
        name: "bitcoin/payment.check" as const,
        data: {
          paymentId: payment.id,
          address: payment.address,
          expectedAmount: payment.amount,
          expiresAt: payment.expiresAt,
          network: payment.network,
        },
      }));

      await step.sendEvent("fan-out-payment-checks", events);

      return {
        message: "Sent check events for all pending payments",
        count: pending.length,
      };
    }
  );

  /**
   * Check an individual payment's status
   * Triggered by the scheduler or manually
   */
  const checkPayment = inngest.createFunction(
    { id: "bitcoin-check-payment" },
    { event: "bitcoin/payment.check" },
    async ({ event, step }: EventContext<"bitcoin/payment.check">) => {
      const { paymentId, address, expectedAmount, expiresAt } = event.data;

      // Check if payment has expired
      const now = Date.now();
      if (now > expiresAt) {
        await step.sendEvent("payment-expired", {
          name: "bitcoin/payment.expired",
          data: {
            paymentId,
            address,
          },
        });
        return { status: "expired", paymentId };
      }

      // Check payment status via Mempool.space API
      const status = await step.run("check-mempool-api", async () => {
        return await mempoolClient.checkPaymentStatus(address, expectedAmount);
      });

      // Get current payment state from storage
      const currentPayment = await step.run("get-current-state", async () => {
        return await storage.getPayment(paymentId);
      });

      if (!currentPayment) {
        return { status: "not-found", paymentId };
      }

      // If payment is in mempool and we haven't notified yet
      if (
        status.inMempool &&
        !status.confirmed &&
        currentPayment.status === "pending"
      ) {
        await step.sendEvent("payment-in-mempool", {
          name: "bitcoin/payment.mempool",
          data: {
            paymentId,
            txid: status?.txid || "",
            amount: status.received,
            address,
          },
        });
      }

      // If payment is confirmed with enough confirmations
      if (
        status.confirmed &&
        status.confirmations >= confirmations &&
        currentPayment.status !== "confirmed"
      ) {
        await step.sendEvent("payment-confirmed-event", {
          name: "bitcoin/payment.confirmed",
          data: {
            paymentId,
            txid: status?.txid || "",
            confirmations: status.confirmations,
            amount: status.received,
            address,
          },
        });
      }

      return {
        status: status.confirmed
          ? "confirmed"
          : status.inMempool
          ? "mempool"
          : "pending",
        paymentId,
        received: status.received,
        confirmations: status.confirmations,
      };
    }
  );

  /**
   * Handle payment entering mempool
   */
  const handleMempool = inngest.createFunction(
    { id: "bitcoin-handle-mempool" },
    { event: "bitcoin/payment.mempool" },
    async ({ event, step }: EventContext<"bitcoin/payment.mempool">) => {
      const { paymentId, txid } = event.data;

      // Update storage to mark payment as in mempool
      await step.run("update-payment-mempool", async () => {
        await storage.updatePaymentStatus(paymentId, {
          status: "mempool",
          txid,
        });
      });

      return {
        message: "Payment marked as in mempool",
        paymentId,
        txid,
      };
    }
  );

  /**
   * Handle payment confirmation
   */
  const handleConfirmed = inngest.createFunction(
    { id: "bitcoin-handle-confirmed" },
    { event: "bitcoin/payment.confirmed" },
    async ({ event, step }: EventContext<"bitcoin/payment.confirmed">) => {
      const { paymentId, txid, confirmations } = event.data;

      // Update storage to mark payment as confirmed
      await step.run("update-payment-confirmed", async () => {
        await storage.updatePaymentStatus(paymentId, {
          status: "confirmed",
          txid,
          confirmations,
        });
      });

      return {
        message: "Payment marked as confirmed",
        paymentId,
        txid,
        confirmations,
      };
    }
  );

  /**
   * Handle payment expiration
   */
  const handleExpired = inngest.createFunction(
    { id: "bitcoin-handle-expired" },
    { event: "bitcoin/payment.expired" },
    async ({ event, step }: EventContext<"bitcoin/payment.expired">) => {
      const { paymentId } = event.data;

      // Update storage to mark payment as expired
      await step.run("update-payment-expired", async () => {
        await storage.updatePaymentStatus(paymentId, {
          status: "expired",
        });
      });

      return {
        message: "Payment marked as expired",
        paymentId,
      };
    }
  );

  return {
    checkPendingPayments,
    checkPayment,
    handleMempool,
    handleConfirmed,
    handleExpired,
  };
}
