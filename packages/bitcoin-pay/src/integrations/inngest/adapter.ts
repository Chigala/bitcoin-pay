/**
 * Adapter to bridge bitcoin-pay's StorageAdapter to Inngest's StorageAdapter
 */

import type { StorageAdapter as BitcoinPayStorageAdapter } from "../../types/adapter.js";
import type {
  StorageAdapter as InngestStorageAdapter,
  PendingPayment,
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
  };
}
