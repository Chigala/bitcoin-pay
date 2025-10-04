/**
 * Inngest event schemas for Bitcoin payment monitoring
 */

export type PaymentEvents = {
  "bitcoin/payment.created": {
    data: {
      paymentId: string;
      address: string;
      expectedAmount: number;
      expiresAt: number;
      network: "mainnet" | "testnet" | "regtest" | "signet";
    };
  };
  "bitcoin/payment.check": {
    data: {
      paymentId: string;
      address: string;
      expectedAmount: number;
      expiresAt: number;
      network: "mainnet" | "testnet" | "regtest" | "signet";
    };
  };
  "bitcoin/payment.mempool": {
    data: {
      paymentId: string;
      txid: string;
      amount: number;
      address: string;
    };
  };
  "bitcoin/payment.confirmed": {
    data: {
      paymentId: string;
      txid: string;
      confirmations: number;
      amount: number;
      address: string;
    };
  };
  "bitcoin/payment.expired": {
    data: {
      paymentId: string;
      address: string;
    };
  };
};

export interface PaymentStatus {
  address: string;
  received: number;
  txid?: string;
  confirmations: number;
  inMempool: boolean;
  confirmed: boolean;
}

export interface MempoolConfig {
  /**
   * Mempool.space API base URL
   * Defaults to "https://mempool.space/api" for mainnet
   * or "https://mempool.space/testnet/api" for testnet
   */
  apiUrl?: string;

  /**
   * Custom network (overrides apiUrl if both provided)
   */
  network?: "mainnet" | "testnet" | "signet";
}

export interface InngestIntegrationConfig {
  /**
   * Unique app ID for Inngest
   */
  appId: string;

  /**
   * Mempool.space API configuration
   */
  mempool?: MempoolConfig;

  /**
   * Storage adapter for tracking payment state
   */
  storage: StorageAdapter;

  /**
   * How often to poll for pending payments (cron format)
   * Default: every 5 minutes
   * Examples: every minute, every 10 minutes, etc.
   */
  pollInterval?: string;

  /**
   * Minimum confirmations required to mark payment as confirmed
   * @default 1
   */
  confirmations?: number;

  /**
   * Optional event key for Inngest Cloud (not needed for dev server)
   */
  eventKey?: string;

  /**
   * Custom callback when payment enters mempool
   */
  onMempool?: (data: PaymentEvents["bitcoin/payment.mempool"]["data"]) => Promise<void>;

  /**
   * Custom callback when payment is confirmed
   */
  onConfirmed?: (data: PaymentEvents["bitcoin/payment.confirmed"]["data"]) => Promise<void>;

  /**
   * Custom callback when payment expires
   */
  onExpired?: (data: PaymentEvents["bitcoin/payment.expired"]["data"]) => Promise<void>;
}

export interface StorageAdapter {
  /**
   * Get all pending payments that need to be checked
   */
  getPendingPayments(): Promise<PendingPayment[]>;

  /**
   * Update payment status
   */
  updatePaymentStatus(
    paymentId: string,
    update: {
      status: "pending" | "mempool" | "confirmed" | "expired";
      txid?: string;
      confirmations?: number;
    }
  ): Promise<void>;

  /**
   * Get payment by ID
   */
  getPayment(paymentId: string): Promise<PendingPayment | null>;
}

export interface PendingPayment {
  id: string;
  address: string;
  amount: number;
  expiresAt: number;
  status: "pending" | "mempool" | "confirmed" | "expired";
  network: "mainnet" | "testnet" | "regtest" | "signet";
  txid?: string;
  confirmations?: number;
}
