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
  "bitcoin/subscription.renewal_created": {
    data: {
      subscriptionId: string;
      planId: string;
      customerId: string | null;
      paymentIntentId: string;
      amount: number;
      cycleNumber: number;
      currentPeriodEnd: string;
    };
  };
  "bitcoin/subscription.renewal_paid": {
    data: {
      subscriptionId: string;
      planId: string;
      customerId: string | null;
      paymentIntentId: string;
      txid: string;
      amount: number;
      cycleNumber: number;
    };
  };
  "bitcoin/subscription.past_due": {
    data: {
      subscriptionId: string;
      planId: string;
      customerId: string | null;
      paymentIntentId: string;
      amount: number;
      cycleNumber: number;
      daysPastDue: number;
    };
  };
  "bitcoin/subscription.canceled": {
    data: {
      subscriptionId: string;
      planId: string;
      customerId: string | null;
      reason: string | null;
      canceledAt: string;
    };
  };
  "bitcoin/subscription.expired": {
    data: {
      subscriptionId: string;
      planId: string;
      customerId: string | null;
      reason: "max_cycles_reached" | "past_due_expired" | "canceled";
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

  /**
   * Subscription configuration (optional)
   */
  subscriptions?: {
    /**
     * How often to check for subscription renewals (cron format)
     * @default "0 0 * * *" (daily at midnight)
     */
    renewalCron?: string;

    /**
     * Grace period in days before marking subscription as expired
     * @default 3
     */
    gracePeriodDays?: number;

    /**
     * Callback when a subscription renewal payment is created
     */
    onRenewalCreated?: (data: PaymentEvents["bitcoin/subscription.renewal_created"]["data"]) => Promise<void>;

    /**
     * Callback when a subscription renewal payment is received
     */
    onRenewalPaid?: (data: PaymentEvents["bitcoin/subscription.renewal_paid"]["data"]) => Promise<void>;

    /**
     * Callback when a subscription payment is past due
     */
    onPastDue?: (data: PaymentEvents["bitcoin/subscription.past_due"]["data"]) => Promise<void>;

    /**
     * Callback when a subscription is canceled
     */
    onCanceled?: (data: PaymentEvents["bitcoin/subscription.canceled"]["data"]) => Promise<void>;

    /**
     * Callback when a subscription expires
     */
    onExpired?: (data: PaymentEvents["bitcoin/subscription.expired"]["data"]) => Promise<void>;
  };
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

  /**
   * Get subscriptions needing renewal
   */
  getSubscriptionsNeedingRenewal?(beforeDate: Date): Promise<PendingSubscription[]>;

  /**
   * Get overdue subscriptions
   */
  getOverdueSubscriptions?(gracePeriodDays: number): Promise<PendingSubscription[]>;

  /**
   * Get subscription by ID
   */
  getSubscription?(subscriptionId: string): Promise<PendingSubscription | null>;

  /**
   * Get subscription plan by ID
   */
  getSubscriptionPlan?(planId: string): Promise<SubscriptionPlan | null>;

  /**
   * Update subscription
   */
  updateSubscription?(
    subscriptionId: string,
    updates: Partial<PendingSubscription>
  ): Promise<void>;

  /**
   * Create payment intent
   */
  createPaymentIntent?(data: {
    subscriptionId?: string;
    billingCycleNumber?: number;
    customerId?: string;
    email?: string;
    amountSats: number;
    memo?: string;
    requiredConfs?: number;
  }): Promise<{ id: string; expiresAt: Date }>;
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

export interface PendingSubscription {
  id: string;
  planId: string;
  customerId: string | null;
  customerEmail: string | null;
  status: "active" | "trialing" | "past_due" | "canceled" | "expired";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  cyclesCompleted: number;
  lastPaymentIntentId: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  amountSats: number;
  interval: "daily" | "weekly" | "monthly" | "yearly";
  intervalCount: number;
  maxCycles: number | null;
}
