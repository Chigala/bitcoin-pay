import type {
  BitcoinPayClientOptions,
  PaymentInitData,
  PaymentStatusData,
} from "./types";

/**
 * Vanilla JavaScript client (no framework dependencies)
 */
export class BitcoinPayClient {
  private baseURL: string;
  private basePath: string;

  constructor(options: BitcoinPayClientOptions = {}) {
    this.baseURL = options.baseURL || "";
    this.basePath = options.basePath || "/api/pay";
  }

  private getURL(path: string): string {
    return `${this.baseURL}${this.basePath}${path}`;
  }

  /**
   * Initialize a payment from magic link token
   */
  async initPayment(token: string): Promise<PaymentInitData> {
    const response = await fetch(this.getURL(`/pay/${token}`), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      // Surface server error body to help debugging (e.g., token already used)
      const body = await response.text().catch(() => "");
      console.log ("this is the body: ", body )
      const message = body || response.statusText;
      throw new Error(`Payment init failed: ${message}`);
    }
    const data: unknown = await response.json();
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>

    console.log("this is the data: ", data )
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const anyData = data as any;
    return {
      intentId: String(anyData.intentId),
      address: String(anyData.address),
      bip21: String(anyData.bip21),
      amountSats: Number(anyData.amountSats),
      expiresAt: new Date(anyData.expiresAt),
      status: String(anyData.status),
    };
  }

  /**
   * Get payment status
   */
  async getStatus(intentId: string): Promise<PaymentStatusData> {
    const response = await fetch(this.getURL(`/status?intentId=${intentId}`), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Get status failed: ${response.statusText}`);
    }
    const data: unknown = await response.json();
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const anyData = data as any;
    const status = String(anyData.status) as PaymentStatusData["status"];
    return {
      id: String(anyData.id ?? intentId),
      customerId: anyData.customerId ? String(anyData.customerId) : null,
      email: anyData.email ? String(anyData.email) : null,
      amountSats: Number(anyData.amountSats),
      status,
      addressId: anyData.addressId ? String(anyData.addressId) : null,
      memo: anyData.memo ? String(anyData.memo) : null,
      requiredConfs: Number(anyData.requiredConfs ?? 1),
      expiresAt: new Date(anyData.expiresAt),
      confirmedAt: anyData.confirmedAt ? new Date(anyData.confirmedAt) : null,
      createdAt: new Date(anyData.createdAt ?? Date.now()),
      updatedAt: new Date(anyData.updatedAt ?? Date.now()),
      txid: anyData.txid ? String(anyData.txid) : undefined,
      confs: anyData.confs !== undefined ? Number(anyData.confs) : undefined,
      valueSats:
        anyData.valueSats !== undefined ? Number(anyData.valueSats) : undefined,
    };
  }

  /**
   * Poll payment status (returns a cleanup function)
   */
  pollStatus(
    intentId: string,
    callback: (data: PaymentStatusData) => void,
    intervalMs = 3000,
  ): () => void {
    const poll = async () => {
      try {
        const data = await this.getStatus(intentId);
        callback(data);

        // Stop polling if terminal state
        if (
          data.status === "confirmed" ||
          data.status === "expired" ||
          data.status === "failed"
        ) {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error("Poll error:", error);
      }
    };

    const intervalId = setInterval(poll, intervalMs);
    poll(); // Initial poll

    return () => clearInterval(intervalId);
  }
}

/**
 * Create a client instance
 */
export function createPaymentClient(
  options?: BitcoinPayClientOptions
): BitcoinPayClient {
  return new BitcoinPayClient(options);
}
