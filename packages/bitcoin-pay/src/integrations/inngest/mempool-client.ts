/**
 * Mempool.space API client for checking Bitcoin payment status
 */

import type { MempoolConfig, PaymentStatus } from "./types.js";

interface MempoolTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    witness: string[];
    is_coinbase: boolean;
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

interface MempoolAddressInfo {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

export class MempoolClient {
  private baseUrl: string;

  constructor(config?: MempoolConfig) {
    if (config?.apiUrl) {
      this.baseUrl = config.apiUrl;
    } else {
      const network = config?.network || "mainnet";
      this.baseUrl = this.getDefaultApiUrl(network);
    }
  }

  private getDefaultApiUrl(network: "mainnet" | "testnet" | "signet" | "regtest"): string {
    switch (network) {
      case "mainnet":
        return "https://mempool.space/api";
      case "testnet":
        return "https://mempool.space/testnet/api";
      case "signet":
        return "https://mempool.space/signet/api";
      case "regtest":
        throw new Error(
          "Regtest network requires a local mempool.space instance. Please provide a custom apiUrl."
        );
    }
  }

  /**
   * Check payment status for a given address and expected amount
   */
  async checkPaymentStatus(address: string, expectedAmount: number): Promise<PaymentStatus> {
    try {
      // Get address info and transactions
      const [addressInfo, txs] = await Promise.all([
        this.getAddressInfo(address),
        this.getAddressTransactions(address),
      ]);

      // Calculate total received (mempool + confirmed)
      const totalReceived = addressInfo.chain_stats.funded_txo_sum + addressInfo.mempool_stats.funded_txo_sum;

      // Find the most recent transaction that pays to this address
      let relevantTx: MempoolTransaction | undefined;
      let receivedAmount = 0;

      for (const tx of txs) {
        // Calculate how much this tx pays to the address
        const amountToAddress = tx.vout
          .filter((vout) => vout.scriptpubkey_address === address)
          .reduce((sum, vout) => sum + vout.value, 0);

        if (amountToAddress >= expectedAmount) {
          relevantTx = tx;
          receivedAmount = amountToAddress;
          break;
        }
      }

      if (!relevantTx) {
        return {
          address,
          received: totalReceived,
          confirmations: 0,
          inMempool: false,
          confirmed: false,
        };
      }

      const isConfirmed = relevantTx.status.confirmed;
      const confirmations = isConfirmed && relevantTx.status.block_height
        ? await this.getConfirmations(relevantTx.status.block_height)
        : 0;

      return {
        address,
        received: receivedAmount,
        txid: relevantTx.txid,
        confirmations,
        inMempool: !isConfirmed,
        confirmed: isConfirmed,
      };
    } catch (error) {
      console.error("Error checking payment status:", error);
      throw error;
    }
  }

  /**
   * Get address information including balance and tx count
   */
  private async getAddressInfo(address: string): Promise<MempoolAddressInfo> {
    const response = await fetch(`${this.baseUrl}/address/${address}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch address info: ${response.statusText}`);
    }
    return response.json() as Promise<MempoolAddressInfo>;
  }

  /**
   * Get all transactions for an address (most recent first)
   */
  private async getAddressTransactions(address: string): Promise<MempoolTransaction[]> {
    const response = await fetch(`${this.baseUrl}/address/${address}/txs`);
    if (!response.ok) {
      throw new Error(`Failed to fetch address transactions: ${response.statusText}`);
    }
    return response.json() as Promise<MempoolTransaction[]>;
  }

  /**
   * Get current block height to calculate confirmations
   */
  private async getConfirmations(blockHeight: number): Promise<number> {
    const response = await fetch(`${this.baseUrl}/blocks/tip/height`);
    if (!response.ok) {
      throw new Error(`Failed to fetch block height: ${response.statusText}`);
    }
    const currentHeight = (await response.json()) as number;
    return currentHeight - blockHeight + 1;
  }

  /**
   * Get transaction details by txid
   */
  async getTransaction(txid: string): Promise<MempoolTransaction> {
    const response = await fetch(`${this.baseUrl}/tx/${txid}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.statusText}`);
    }
    return response.json() as Promise<MempoolTransaction>;
  }
}
