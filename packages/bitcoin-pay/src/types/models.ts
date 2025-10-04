import { z } from "zod";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "confirmed"
  | "expired"
  | "failed";

export const paymentIntentSchema = z.object({
  id: z.string(),
  customerId: z.string().nullish(),
  email: z.string().email().nullish(),
  amountSats: z.number().int().positive(),
  status: z.enum(["pending", "processing", "confirmed", "expired", "failed"]),
  addressId: z.string().nullish(),
  memo: z.string().nullish(),
  requiredConfs: z.number().int().default(1),
  expiresAt: z.date(),
  confirmedAt: z.date().nullish(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;

export const depositAddressSchema = z.object({
  id: z.string(),
  address: z.string(),
  derivationIndex: z.number().int(),
  scriptPubKeyHex: z.string(),
  intentId: z.string().nullish(),
  assignedAt: z.date().nullish(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type DepositAddress = z.infer<typeof depositAddressSchema>;

export const txObservationSchema = z.object({
  id: z.string(),
  txid: z.string(),
  vout: z.number().int(),
  valueSats: z.number().int(),
  confirmations: z.number().int().default(0),
  addressId: z.string(),
  scriptPubKeyHex: z.string(),
  status: z.enum(["mempool", "confirmed"]).default("mempool"),
  seenAt: z.date(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type TxObservation = z.infer<typeof txObservationSchema>;

export const magicLinkTokenSchema = z.object({
  id: z.string(),
  token: z.string(),
  intentId: z.string(),
  consumed: z.boolean().default(false),
  consumedAt: z.date().nullish(),
  expiresAt: z.date(),
  createdAt: z.date().default(() => new Date()),
});

export type MagicLinkToken = z.infer<typeof magicLinkTokenSchema>;

export const customerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullish(),
  metadata: z.record(z.unknown()).nullish(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Customer = z.infer<typeof customerSchema>;
