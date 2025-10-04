import type { PaymentIntent } from "../types/models";

/**
 * Client options
 */
export interface BitcoinPayClientOptions {
  /**
   * Base URL of the Bitcoin Pay API
   * If not provided, uses same origin
   */
  baseURL?: string;

  /**
   * Base path for API routes
   * @default "/api/pay"
   */
  basePath?: string;
}

/**
 * Payment initialization data
 */
export interface PaymentInitData {
  intentId: string;
  address: string;
  bip21: string;
  amountSats: number;
  expiresAt: Date;
  status: string;
}

/**
 * Payment status response
 */
export interface PaymentStatusData extends PaymentIntent {
  txid?: string;
  confs?: number;
  valueSats?: number;
}
