/**
 * Inngest client wrapper with typed event schemas
 */

import { Inngest, EventSchemas } from "inngest";
import type { PaymentEvents } from "./types.js";

/**
 * Create a typed Inngest client for Bitcoin payments
 */
export function createBitcoinPaymentClient(config: {
  id: string;
  eventKey?: string;
}) {
  return new Inngest({
    id: config.id,
    eventKey: config.eventKey,
    schemas: new EventSchemas().fromRecord<PaymentEvents>(),
  });
}
