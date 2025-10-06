/**
 * Adapter to bridge bitcoin-pay's StorageAdapter to Inngest's StorageAdapter
 */

import type { StorageAdapter as BitcoinPayStorageAdapter } from "../../types/adapter.js";
import type {
  StorageAdapter as InngestStorageAdapter,
  PendingPayment,
  PendingSubscription,
  SubscriptionPlan,
} from "./types.js";

/**
 * Creates an Inngest-compatible storage adapter from bitcoin-pay's storage adapter
 */
export function createInngestStorageAdapter(
  storage: BitcoinPayStorageAdapter,
  network: "mainnet" | "testnet" | "regtest" | "signet"
): InngestStorageAdapter {
  return {
    async getPendingPayments(): Promise<PendingPayment[]> {
      // Get all pending and processing intents
      const pending = await storage.listPaymentIntentsByStatus("pending");
      const processing = await storage.listPaymentIntentsByStatus("processing");

      const all = [...pending, ...processing];

      // Map to PendingPayment format
      const payments: PendingPayment[] = [];

      for (const intent of all) {
        if (!intent.addressId) continue;

        const address = await storage.getDepositAddress(intent.addressId);
        if (!address) continue;

        // Get any tx observations for this intent
        const txs = await storage.getTxObservationsByIntent(intent.id);
        const tx = txs[0]; // Most recent

        payments.push({
          id: intent.id,
          address: address.address,
          amount: intent.amountSats,
          expiresAt: intent.expiresAt.getTime(),
          status:
            intent.status === "processing"
              ? "mempool"
              : intent.status === "confirmed"
              ? "confirmed"
              : intent.status === "expired"
              ? "expired"
              : "pending",
          network,
          txid: tx?.txid,
          confirmations: tx?.confirmations,
        });
      }

      return payments;
    },

    async updatePaymentStatus(
      paymentId: string,
      update: {
        status: "pending" | "mempool" | "confirmed" | "expired";
        txid?: string;
        confirmations?: number;
      }
    ): Promise<void> {
      // Map Inngest status to bitcoin-pay status
      const statusMap = {
        pending: "pending",
        mempool: "processing",
        confirmed: "confirmed",
        expired: "expired",
      } as const;

      const intent = await storage.getPaymentIntent(paymentId);
      if (!intent) return;

      // Update intent status
      await storage.updatePaymentIntent(paymentId, {
        status: statusMap[update.status],
        confirmedAt: update.status === "confirmed" ? new Date() : undefined,
      });

      // If we have a txid, create or update tx observation
      if (update.txid && intent.addressId) {
        const address = await storage.getDepositAddress(intent.addressId);
        if (!address) return;

        const existing = await storage.getTxObservationByTxid(update.txid);

        if (existing) {
          // Update existing observation
          await storage.updateTxObservation(existing.id, {
            confirmations: update.confirmations ?? 0,
          });
        } else {
          // Create new observation
          await storage.createTxObservation({
            txid: update.txid,
            vout: 0, // We don't know the vout from Mempool API
            addressId: address.id,
            scriptPubKeyHex: address.scriptPubKeyHex,
            valueSats: intent.amountSats,
            status: update.status === "confirmed" ? "confirmed" : "mempool",
            confirmations: update.confirmations ?? 0,
            seenAt: new Date(),
          });
        }
      }
    },

    async getPayment(paymentId: string): Promise<PendingPayment | null> {
      const intent = await storage.getPaymentIntent(paymentId);
      if (!intent || !intent.addressId) return null;

      const address = await storage.getDepositAddress(intent.addressId);
      if (!address) return null;

      const txs = await storage.getTxObservationsByIntent(intent.id);
      const tx = txs[0];

      return {
        id: intent.id,
        address: address.address,
        amount: intent.amountSats,
        expiresAt: intent.expiresAt.getTime(),
        status:
          intent.status === "processing"
            ? "mempool"
            : intent.status === "confirmed"
            ? "confirmed"
            : intent.status === "expired"
            ? "expired"
            : "pending",
        network,
        txid: tx?.txid,
        confirmations: tx?.confirmations,
      };
    },

    // Subscription methods (optional, only if storage supports them)
    ...(storage.getSubscriptionsNeedingRenewal
      ? {
          async getSubscriptionsNeedingRenewal(
            beforeDate: Date
          ): Promise<PendingSubscription[]> {
            if (!storage.getSubscriptionsNeedingRenewal) {
              return [];
            }

            const subscriptions = await storage.getSubscriptionsNeedingRenewal(
              beforeDate
            );

            return subscriptions.map((sub) => ({
              id: sub.id,
              planId: sub.planId,
              customerId: sub.customerId,
              customerEmail: sub.customerEmail,
              status: sub.status as PendingSubscription["status"],
              currentPeriodStart: sub.currentPeriodStart,
              currentPeriodEnd: sub.currentPeriodEnd,
              trialStart: sub.trialStart,
              trialEnd: sub.trialEnd,
              cyclesCompleted: sub.cyclesCompleted,
              lastPaymentIntentId: sub.lastPaymentIntentId,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            }));
          },
        }
      : {}),

    ...(storage.getOverdueSubscriptions
      ? {
          async getOverdueSubscriptions(
            gracePeriodDays: number
          ): Promise<PendingSubscription[]> {
            if (!storage.getOverdueSubscriptions) {
              return [];
            }

            const subscriptions = await storage.getOverdueSubscriptions(
              gracePeriodDays
            );

            return subscriptions.map((sub) => ({
              id: sub.id,
              planId: sub.planId,
              customerId: sub.customerId,
              customerEmail: sub.customerEmail,
              status: sub.status as PendingSubscription["status"],
              currentPeriodStart: sub.currentPeriodStart,
              currentPeriodEnd: sub.currentPeriodEnd,
              trialStart: sub.trialStart,
              trialEnd: sub.trialEnd,
              cyclesCompleted: sub.cyclesCompleted,
              lastPaymentIntentId: sub.lastPaymentIntentId,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            }));
          },
        }
      : {}),

    ...(storage.getSubscription
      ? {
          async getSubscription(
            subscriptionId: string
          ): Promise<PendingSubscription | null> {
            if (!storage.getSubscription) {
              return null;
            }

            const sub = await storage.getSubscription(subscriptionId);
            if (!sub) return null;

            return {
              id: sub.id,
              planId: sub.planId,
              customerId: sub.customerId,
              customerEmail: sub.customerEmail,
              status: sub.status as PendingSubscription["status"],
              currentPeriodStart: sub.currentPeriodStart,
              currentPeriodEnd: sub.currentPeriodEnd,
              trialStart: sub.trialStart,
              trialEnd: sub.trialEnd,
              cyclesCompleted: sub.cyclesCompleted,
              lastPaymentIntentId: sub.lastPaymentIntentId,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            };
          },
        }
      : {}),

    ...(storage.getSubscriptionPlan
      ? {
          async getSubscriptionPlan(
            planId: string
          ): Promise<SubscriptionPlan | null> {
            if (!storage.getSubscriptionPlan) {
              return null;
            }

            const plan = await storage.getSubscriptionPlan(planId);
            if (!plan) return null;

            return {
              id: plan.id,
              name: plan.name,
              amountSats: plan.amountSats,
              interval: plan.interval as SubscriptionPlan["interval"],
              intervalCount: plan.intervalCount,
              maxCycles: plan.maxCycles,
            };
          },
        }
      : {}),

    ...(storage.updateSubscription
      ? {
          async updateSubscription(
            subscriptionId: string,
            updates: Partial<PendingSubscription>
          ): Promise<void> {
            if (!storage.updateSubscription) {
              return;
            }
            await storage.updateSubscription(subscriptionId, updates);
          },
        }
      : {}),

    ...(storage.createPaymentIntent
      ? {
          async createPaymentIntent(data: {
            subscriptionId?: string;
            billingCycleNumber?: number;
            customerId?: string;
            email?: string;
            amountSats: number;
            memo?: string;
            requiredConfs?: number;
          }): Promise<{ id: string; expiresAt: Date }> {
            if (!storage.createPaymentIntent) {
              throw new Error("createPaymentIntent is not supported by storage adapter");
            }

            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            const intent = await storage.createPaymentIntent({
              customerId: data.customerId ?? null,
              email: data.email ?? null,
              amountSats: data.amountSats,
              status: "pending",
              addressId: null,
              memo: data.memo ?? null,
              requiredConfs: data.requiredConfs || 1,
              expiresAt,
              confirmedAt: null,
              subscriptionId: data.subscriptionId ?? null,
              billingCycleNumber: data.billingCycleNumber ?? null,
            });

            return {
              id: intent.id,
              expiresAt: intent.expiresAt,
            };
          },
        }
      : {}),
  };
}
