/**
 * Inngest functions for monitoring Bitcoin payments
 */

import type { Inngest } from "inngest";
import type { StorageAdapter, PaymentEvents, PendingPayment, PendingSubscription, SubscriptionPlan } from "./types.js";
import type { MempoolClient } from "./mempool-client.js";

export interface WatcherConfig {
  inngest: Inngest;
  storage: StorageAdapter;
  mempoolClient: MempoolClient;
  pollInterval: string;
  confirmations: number;
  subscriptions?: {
    renewalCron?: string;
    gracePeriodDays?: number;
  };
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

  /**
   * Helper function to calculate next period end based on interval
   */
  function calculateNextPeriodEnd(
    currentEnd: Date,
    interval: string,
    intervalCount: number
  ): Date {
    const nextEnd = new Date(currentEnd);

    switch (interval) {
      case "daily":
        nextEnd.setDate(nextEnd.getDate() + intervalCount);
        break;
      case "weekly":
        nextEnd.setDate(nextEnd.getDate() + 7 * intervalCount);
        break;
      case "monthly":
        nextEnd.setMonth(nextEnd.getMonth() + intervalCount);
        break;
      case "yearly":
        nextEnd.setFullYear(nextEnd.getFullYear() + intervalCount);
        break;
    }

    return nextEnd;
  }

  // Subscription renewal functions (only if storage supports subscriptions)
  const subscriptionFunctions =
    storage.getSubscriptionsNeedingRenewal &&
    storage.getOverdueSubscriptions &&
    storage.getSubscription &&
    storage.getSubscriptionPlan &&
    storage.updateSubscription &&
    storage.createPaymentIntent
      ? {
          /**
           * Check for subscriptions that need renewal
           * Runs daily (or custom cron) to create renewal payment intents
           */
          checkSubscriptionRenewals: inngest.createFunction(
            { id: "bitcoin-check-subscription-renewals" },
            { cron: config.subscriptions?.renewalCron || "0 0 * * *" },
            async ({ step }: CronContext) => {
              // Check for subscriptions ending in next 24 hours
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);

              const needingRenewal = await step.run(
                "load-subscriptions-needing-renewal",
                async () => {
                  if (!storage.getSubscriptionsNeedingRenewal) {
                    throw new Error("getSubscriptionsNeedingRenewal not supported");
                  }
                  return await storage.getSubscriptionsNeedingRenewal(tomorrow);
                }
              );

              if (needingRenewal.length === 0) {
                return {
                  message: "No subscriptions need renewal",
                  count: 0,
                };
              }

              // Process each subscription renewal
              for (const subscription of needingRenewal) {
                await step.run(
                  `renew-subscription-${subscription.id}`,
                  async () => {
                    if (!storage.getSubscriptionPlan) {
                      throw new Error("getSubscriptionPlan not supported");
                    }

                    const plan = await storage.getSubscriptionPlan(
                      subscription.planId
                    );

                    if (!plan) {
                      console.error(
                        `Plan not found for subscription ${subscription.id}`
                      );
                      return;
                    }

                    // Check if subscription has reached max cycles
                    if (
                      plan.maxCycles &&
                      subscription.cyclesCompleted >= plan.maxCycles
                    ) {
                      if (!storage.updateSubscription) {
                        throw new Error("updateSubscription not supported");
                      }
                      await storage.updateSubscription(subscription.id, {
                        status: "expired",
                      });

                      await step.sendEvent("subscription-max-cycles", {
                        name: "bitcoin/subscription.expired",
                        data: {
                          subscriptionId: subscription.id,
                          planId: subscription.planId,
                          customerId: subscription.customerId,
                          reason: "max_cycles_reached",
                        },
                      });
                      return;
                    }

                    // Create renewal payment intent
                    if (!storage.createPaymentIntent) {
                      throw new Error("createPaymentIntent not supported");
                    }
                    const paymentIntent = await storage.createPaymentIntent({
                      subscriptionId: subscription.id,
                      billingCycleNumber: subscription.cyclesCompleted + 1,
                      customerId: subscription.customerId || undefined,
                      email: subscription.customerEmail || undefined,
                      amountSats: plan.amountSats,
                      memo: `Subscription renewal - ${plan.name} (Cycle ${subscription.cyclesCompleted + 1})`,
                      requiredConfs: confirmations,
                    });

                    // Calculate next period
                    const nextPeriodStart = subscription.currentPeriodEnd;
                    const nextPeriodEnd = calculateNextPeriodEnd(
                      subscription.currentPeriodEnd,
                      plan.interval,
                      plan.intervalCount
                    );

                    // Update subscription
                    if (!storage.updateSubscription) {
                      throw new Error("updateSubscription not supported");
                    }
                    await storage.updateSubscription(subscription.id, {
                      currentPeriodStart: nextPeriodStart,
                      currentPeriodEnd: nextPeriodEnd,
                      lastPaymentIntentId: paymentIntent.id,
                      status:
                        subscription.status === "trialing" ? "active" : subscription.status,
                    });

                    // Send renewal created event
                    await step.sendEvent("subscription-renewal-created", {
                      name: "bitcoin/subscription.renewal_created",
                      data: {
                        subscriptionId: subscription.id,
                        planId: subscription.planId,
                        customerId: subscription.customerId,
                        paymentIntentId: paymentIntent.id,
                        amount: plan.amountSats,
                        cycleNumber: subscription.cyclesCompleted + 1,
                        currentPeriodEnd: nextPeriodEnd.toISOString(),
                      },
                    });
                  }
                );
              }

              return {
                message: "Processed subscription renewals",
                count: needingRenewal.length,
              };
            }
          ),

          /**
           * Check for overdue subscriptions
           * Runs every 6 hours to mark subscriptions as expired if past grace period
           */
          checkOverdueSubscriptions: inngest.createFunction(
            { id: "bitcoin-check-overdue-subscriptions" },
            { cron: "0 */6 * * *" },
            async ({ step }: CronContext) => {
              const gracePeriodDays =
                config.subscriptions?.gracePeriodDays || 3;

              const overdue = await step.run(
                "load-overdue-subscriptions",
                async () => {
                  if (!storage.getOverdueSubscriptions) {
                    throw new Error("getOverdueSubscriptions not supported");
                  }
                  return await storage.getOverdueSubscriptions(gracePeriodDays);
                }
              );

              if (overdue.length === 0) {
                return { message: "No overdue subscriptions", count: 0 };
              }

              // Process each overdue subscription
              for (const subscription of overdue) {
                await step.run(`expire-subscription-${subscription.id}`, async () => {
                  // Mark as expired
                  if (!storage.updateSubscription) {
                    throw new Error("updateSubscription not supported");
                  }
                  await storage.updateSubscription(subscription.id, {
                    status: "expired",
                  });

                  await step.sendEvent("subscription-past-due-expired", {
                    name: "bitcoin/subscription.expired",
                    data: {
                      subscriptionId: subscription.id,
                      planId: subscription.planId,
                      customerId: subscription.customerId,
                      reason: "past_due_expired",
                    },
                  });
                });
              }

              return {
                message: "Expired overdue subscriptions",
                count: overdue.length,
              };
            }
          ),

          /**
           * Monitor subscription payment confirmations
           * Triggered when a payment is confirmed
           */
          handleSubscriptionPayment: inngest.createFunction(
            { id: "bitcoin-handle-subscription-payment" },
            { event: "bitcoin/payment.confirmed" },
            async ({ event, step }: EventContext<"bitcoin/payment.confirmed">) => {
              // Get the payment to check if it's for a subscription
              const payment = await step.run("get-payment", async () => {
                return await storage.getPayment(event.data.paymentId);
              });

              // This would need subscription info from payment
              // For now, we'll skip if no subscription support in payment
              if (!payment) {
                return { message: "Payment not found", skipped: true };
              }

              return {
                message: "Subscription payment processed",
                paymentId: event.data.paymentId,
              };
            }
          ),
        }
      : {};

  return {
    checkPendingPayments,
    checkPayment,
    handleMempool,
    handleConfirmed,
    handleExpired,
    ...subscriptionFunctions,
  };
}
