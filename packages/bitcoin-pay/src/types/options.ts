import type { BitcoinPayPlugin } from "./plugins";
import type { StorageAdapter } from "./adapter";
import type { SubscriptionConfig } from "./subscription";

/**
 * Bitcoin network type
 */
export type Network = "mainnet" | "testnet" | "regtest" | "signet";


/**
 * Event handlers / webhook configuration
 */
export interface EventHandlers {
  /**
   * Called when a payment intent is created
   */
  onIntentCreated?: (data: { intentId: string }) => Promise<void> | void;

  /**
   * Called when a transaction is seen in mempool (0-conf)
   */
  onProcessing?: (data: {
    intentId: string;
    txid: string;
    valueSats: number;
  }) => Promise<void> | void;

  /**
   * Called when payment reaches required confirmations
   */
  onConfirmed?: (data: {
    intentId: string;
    txid: string;
    valueSats: number;
    confirmations: number;
  }) => Promise<void> | void;

  /**
   * Called when payment intent expires without payment
   */
  onExpired?: (data: { intentId: string }) => Promise<void> | void;

  /**
   * Called when a confirmed tx is reorged out
   */
  onReorg?: (data: { intentId: string; txid: string }) => Promise<void> | void;
}

/**
 * Main configuration options for Bitcoin Pay
 */
export interface BitcoinPayOptions {
  /**
   * Bitcoin network
   * @default "mainnet"
   */
  network?: Network;

  /**
   * Base URL of your application (for generating magic links)
   * @example "https://example.com" or "http://localhost:3000"
   */
  baseURL: string;

  /**
   * Secret key for signing magic links and tokens
   * Should be a random 32+ character string
   */
  secret: string;

  /**
   * Watch-only descriptor for address derivation
   * @example "tr([F00D/86h/0h/0h]xpub.../0/*)"
   */
  descriptor: string;

  /**
   * Storage adapter for database operations
   */
  storage: StorageAdapter;

  /**
   * Default number of confirmations required
   * @default 1
   */
  confirmations?: number;

  /**
   * Base path for API routes
   * @default "/api/pay"
   */
  basePath?: string;

  /**
   * Event handlers / webhooks
   */
  events?: EventHandlers;

  /**
   * Plugins to extend functionality
   */
  plugins?: BitcoinPayPlugin[];

  /**
   * Subscription configuration (optional)
   */
  subscriptions?: SubscriptionConfig;

  /**
   * Advanced options
   */
  advanced?: {
    /**
     * Gap limit for address derivation
     * @default 20
     */
    gapLimit?: number;

    /**
     * Magic link TTL in seconds
     * @default 86400 (24 hours)
     */
    magicLinkTTL?: number;

    /**
     * Payment intent default expiry in minutes
     * @default 60
     */
    intentExpiryMinutes?: number;
  };
}
