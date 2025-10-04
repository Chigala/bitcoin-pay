import type * as bitcoin from "bitcoinjs-lib";
import { ZMQWatcher, type ZMQConfig } from "./zmq.js";
import { BitcoinRPC, type RPCConfig, type Transaction } from "./rpc.js";
import type { StorageAdapter } from "../types/adapter.js";
import type { TxObservation, PaymentIntent } from "../types/models.js";

export * from "./zmq.js";
export * from "./rpc.js";

export interface WatcherConfig {
  zmq: ZMQConfig;
  rpc: RPCConfig;
  storage: StorageAdapter;
  network: bitcoin.Network;
  confirmations: number;
  pollIntervalMs?: number;
}

export interface WatcherEventHandlers {
  onProcessing?: (data: {
    intentId: string;
    txid: string;
    valueSats: number;
  }) => void | Promise<void>;
  onConfirmed?: (data: {
    intentId: string;
    txid: string;
    valueSats: number;
    confirmations: number;
  }) => void | Promise<void>;
  onReorg?: (data: { intentId: string; txid: string }) => void | Promise<void>;
}

export class BitcoinWatcher {
  private zmq: ZMQWatcher;
  private rpc: BitcoinRPC;
  private storage: StorageAdapter;
  private network: bitcoin.Network;
  private requiredConfs: number;
  private eventHandlers: WatcherEventHandlers;
  private pollInterval?: NodeJS.Timeout;
  private isRunning = false;
  private watchedAddresses = new Set<string>();
  private addressToIntentMap = new Map<string, string>();

  constructor(config: WatcherConfig, eventHandlers: WatcherEventHandlers = {}) {
    this.storage = config.storage;
    this.network = config.network;
    this.requiredConfs = config.confirmations;
    this.eventHandlers = eventHandlers;
    this.rpc = new BitcoinRPC(config.rpc);

    this.zmq = new ZMQWatcher(config.zmq, {
      onHashTx: async (hash, sequence) => {
        const txid = hash.reverse().toString("hex");
        await this.onNewTransaction(txid);
      },
      onHashBlock: async (hash, sequence) => {
        await this.onNewBlock();
      },
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Watcher already running");
    }

    // Load all assigned addresses into memory
    await this.loadWatchedAddresses();

    // Start ZMQ listener (no-op if no ports configured)
    await this.zmq.start();

    // Start polling for confirmation updates
    this.startPolling();

    this.isRunning = true;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    await this.zmq.stop();
    this.stopPolling();
    this.watchedAddresses.clear();
    this.addressToIntentMap.clear();
    this.isRunning = false;
  }

  async addAddress(address: string, intentId: string): Promise<void> {
    this.watchedAddresses.add(address);
    this.addressToIntentMap.set(address, intentId);
  }

  async removeAddress(address: string): Promise<void> {
    this.watchedAddresses.delete(address);
    this.addressToIntentMap.delete(address);
  }

  private async loadWatchedAddresses(): Promise<void> {
    const addresses = await this.storage.listAssignedAddresses();
    for (const addr of addresses) {
      if (addr.intentId) {
        this.watchedAddresses.add(addr.address);
        this.addressToIntentMap.set(addr.address, addr.intentId);
      }
    }
  }

  private async onNewTransaction(txid: string): Promise<void> {
    try {
      const tx = await this.rpc.getRawTransaction(txid, true);
      if (typeof tx === "string") return; // Should not happen with verbose=true

      await this.processTx(tx as Transaction, 0);
    } catch (err) {
      console.error(`Failed to process new tx ${txid}:`, err);
    }
  }

  private async onNewBlock(): Promise<void> {
    // Check all pending/processing intents for confirmation updates
    await this.checkConfirmations();
  }

  private async processTx(
    tx: Transaction,
    confirmations: number
  ): Promise<void> {
    for (const vout of tx.vout) {
      const address = vout.scriptPubKey.address;
      if (!address || !this.watchedAddresses.has(address)) continue;

      const intentId = this.addressToIntentMap.get(address);
      if (!intentId) continue;

      const valueSats = Math.round(vout.value * 1e8);

      // Check if we already recorded this observation
      const existing = await this.storage.getTxObservationByTxidVout(
        tx.txid,
        vout.n
      );
      if (existing) {
        // Update confirmations if changed
        if (existing.confirmations !== confirmations) {
          await this.storage.updateTxObservation(existing.id, {
            confirmations,
            updatedAt: new Date(),
          });

          // Check if now confirmed
          if (
            confirmations >= this.requiredConfs &&
            existing.confirmations < this.requiredConfs
          ) {
            await this.markIntentConfirmed(
              intentId,
              tx.txid,
              valueSats,
              confirmations
            );
          }
        }
        return;
      }

      // Create new observation
      const addressRecord = await this.storage.getDepositAddressByAddress(
        address
      );
      if (!addressRecord) continue;

      await this.storage.createTxObservation({
        txid: tx.txid,
        vout: vout.n,
        valueSats,
        confirmations,
        addressId: addressRecord.id,
        scriptPubKeyHex: vout.scriptPubKey.hex,
        status: confirmations >= this.requiredConfs ? "confirmed" : "mempool",
        seenAt: new Date(),
      });

      // Update intent status
      const intent = await this.storage.getPaymentIntent(intentId);
      if (!intent) continue;

      if (confirmations === 0) {
        // Mempool transaction - mark as processing
        if (intent.status === "pending") {
          await this.storage.updatePaymentIntent(intentId, {
            status: "processing",
            updatedAt: new Date(),
          });

          await this.eventHandlers.onProcessing?.({
            intentId,
            txid: tx.txid,
            valueSats,
          });
        }
      } else if (confirmations >= this.requiredConfs) {
        // Confirmed transaction
        await this.markIntentConfirmed(
          intentId,
          tx.txid,
          valueSats,
          confirmations
        );
      }
    }
  }

  private async markIntentConfirmed(
    intentId: string,
    txid: string,
    valueSats: number,
    confirmations: number
  ): Promise<void> {
    const intent = await this.storage.getPaymentIntent(intentId);
    if (!intent || intent.status === "confirmed") return;

    await this.storage.updatePaymentIntent(intentId, {
      status: "confirmed",
      confirmedAt: new Date(),
      updatedAt: new Date(),
    });

    await this.eventHandlers.onConfirmed?.({
      intentId,
      txid,
      valueSats,
      confirmations,
    });

    // Remove from active watching
    if (intent.addressId) {
      const addr = await this.storage.getDepositAddress(intent.addressId);
      if (addr) {
        this.removeAddress(addr.address);
      }
    }
  }

  private async checkConfirmations(): Promise<void> {
    try {
      // Get all processing intents
      const observations = await this.storage.listPendingTxObservations();

      for (const obs of observations) {
        try {
          const tx = await this.rpc.getRawTransaction(obs.txid, true);
          if (typeof tx === "string") continue;

          const txData = tx as Transaction;
          const newConfs = txData.confirmations || 0;

          if (newConfs !== obs.confirmations) {
            await this.storage.updateTxObservation(obs.id, {
              confirmations: newConfs,
              status: newConfs >= this.requiredConfs ? "confirmed" : "mempool",
              updatedAt: new Date(),
            });

            // Check if intent should be marked confirmed
            const address = await this.storage.getDepositAddress(obs.addressId);
            if (address?.intentId && newConfs >= this.requiredConfs) {
              await this.markIntentConfirmed(
                address.intentId,
                obs.txid,
                obs.valueSats,
                newConfs
              );
            }
          }
        } catch (err) {
          const error = err as { message?: string };
          if (
            error.message?.includes("No such mempool or blockchain transaction")
          ) {
            await this.handleReorg(obs);
          } else {
            console.error(`Error checking tx ${obs.txid}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("Error checking confirmations:", err);
    }
  }

  private async handleReorg(obs: TxObservation): Promise<void> {
    // Mark observation as invalid
    await this.storage.updateTxObservation(obs.id, {
      status: "mempool",
      confirmations: 0,
      updatedAt: new Date(),
    });

    // Revert intent status if it was confirmed
    const address = await this.storage.getDepositAddress(obs.addressId);
    if (address?.intentId) {
      const intent = await this.storage.getPaymentIntent(address.intentId);
      if (intent?.status === "confirmed") {
        await this.storage.updatePaymentIntent(address.intentId, {
          status: "processing",
          confirmedAt: null,
          updatedAt: new Date(),
        });

        await this.eventHandlers.onReorg?.({
          intentId: address.intentId,
          txid: obs.txid,
        });
      }
    }
  }

  private startPolling(intervalMs = 30000): void {
    this.pollInterval = setInterval(() => {
      this.checkConfirmations();
    }, intervalMs);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  async scanForPayments(intentId: string): Promise<void> {
    const intent = await this.storage.getPaymentIntent(intentId);
    if (!intent?.addressId) return;

    const address = await this.storage.getDepositAddress(intent.addressId);
    if (!address) return;

    // Check for UTXOs on this address
    const utxos = await this.rpc.listUnspent(0, 9999999, [address.address]);

    for (const utxo of utxos) {
      const tx = await this.rpc.getRawTransaction(utxo.txid, true);
      if (typeof tx === "string") continue;

      await this.processTx(tx as Transaction, utxo.confirmations);
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
