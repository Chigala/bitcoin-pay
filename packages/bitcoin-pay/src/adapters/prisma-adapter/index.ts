import { nanoid } from "nanoid";
import type { StorageAdapter } from "../../types/adapter.js";
import type {
  PaymentIntent,
  DepositAddress,
  TxObservation,
  MagicLinkToken,
  Customer,
} from "../../types/models.js";

interface PrismaClient {
  bitcoinPayPaymentIntent: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: { where: Record<string, unknown>; orderBy: Record<string, string> }) => Promise<unknown[]>;
  };
  bitcoinPayDepositAddress: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findUnique: (args: { where: { id?: string; address?: string } }) => Promise<unknown>;
    findFirst: (args: { where: Record<string, unknown>; orderBy?: Record<string, string> }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: { where: Record<string, unknown> }) => Promise<unknown[]>;
    aggregate: (args: { _max: { derivationIndex: boolean } }) => Promise<{ _max: { derivationIndex: number | null } }>;
  };
  bitcoinPayTxObservation: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findFirst: (args: { where: Record<string, unknown> }) => Promise<unknown>;
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
    findMany: (args: { where: Record<string, unknown>; orderBy: Record<string, string> }) => Promise<unknown[]>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  bitcoinPayMagicLinkToken: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findUnique: (args: { where: { token: string } }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  bitcoinPayCustomer: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findUnique: (args: { where: { id?: string; email?: string } }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  $transaction: <T>(queries: unknown[]) => Promise<T[]>;
}

interface PrismaResult {
  amountSats?: bigint | number;
  valueSats?: bigint | number;
  metadata?: string | null;
  [key: string]: unknown;
}

export function prismaAdapter(prisma: PrismaClient): StorageAdapter {
  return {
    async createPaymentIntent(data): Promise<PaymentIntent> {
      const id = nanoid();
      const now = new Date();

      const created = await prisma.bitcoinPayPaymentIntent.create({
        data: {
          id,
          customerId: data.customerId ?? null,
          email: data.email ?? null,
          amountSats: BigInt(data.amountSats),
          status: data.status,
          addressId: data.addressId ?? null,
          memo: data.memo ?? null,
          requiredConfs: data.requiredConfs || 1,
          expiresAt: data.expiresAt,
          confirmedAt: data.confirmedAt ?? null,
          createdAt: now,
          updatedAt: now,
        },
      }) as PrismaResult;

      return {
        ...created,
        amountSats: Number(created.amountSats),
      } as PaymentIntent;
    },

    async getPaymentIntent(id): Promise<PaymentIntent | null> {
      const result = await prisma.bitcoinPayPaymentIntent.findUnique({
        where: { id },
      }) as PrismaResult | null;

      if (!result) return null;

      return {
        ...result,
        amountSats: Number(result.amountSats),
      } as PaymentIntent;
    },

    async updatePaymentIntent(id, data): Promise<PaymentIntent> {
      const updated = await prisma.bitcoinPayPaymentIntent.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      }) as PrismaResult;

      return {
        ...updated,
        amountSats: Number(updated.amountSats),
      } as PaymentIntent;
    },

    async listPaymentIntentsByStatus(status): Promise<PaymentIntent[]> {
      const results = await prisma.bitcoinPayPaymentIntent.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
      }) as PrismaResult[];

      return results.map((r) => ({
        ...r,
        amountSats: Number(r.amountSats),
      })) as PaymentIntent[];
    },

    async createDepositAddress(data): Promise<DepositAddress> {
      const id = nanoid();
      const now = new Date();

      const created = await prisma.bitcoinPayDepositAddress.create({
        data: {
          id,
          address: data.address,
          derivationIndex: data.derivationIndex,
          scriptPubKeyHex: data.scriptPubKeyHex,
          intentId: data.intentId ?? null,
          assignedAt: data.assignedAt ?? null,
          createdAt: now,
        },
      });

      return created as DepositAddress;
    },

    async getDepositAddress(id): Promise<DepositAddress | null> {
      const result = await prisma.bitcoinPayDepositAddress.findUnique({
        where: { id },
      });

      return (result as DepositAddress) || null;
    },

    async getDepositAddressByAddress(address): Promise<DepositAddress | null> {
      const result = await prisma.bitcoinPayDepositAddress.findUnique({
        where: { address },
      });

      return (result as DepositAddress) || null;
    },

    async getUnassignedAddress(): Promise<DepositAddress | null> {
      const result = await prisma.bitcoinPayDepositAddress.findFirst({
        where: { intentId: null },
        orderBy: { derivationIndex: "asc" },
      });

      return (result as DepositAddress) || null;
    },

    async assignAddressToIntent(addressId, intentId): Promise<DepositAddress> {
      const now = new Date();

      const result = await prisma.$transaction([
        prisma.bitcoinPayDepositAddress.update({
          where: { id: addressId },
          data: { intentId, assignedAt: now },
        }),
        prisma.bitcoinPayPaymentIntent.update({
          where: { id: intentId },
          data: { addressId, updatedAt: now },
        }),
      ]);

      return result[0] as DepositAddress;
    },

    async getNextDerivationIndex(): Promise<number> {
      const result = await prisma.bitcoinPayDepositAddress.aggregate({
        _max: { derivationIndex: true },
      });

      const maxIndex = result._max.derivationIndex;
      return maxIndex !== null && maxIndex !== undefined ? maxIndex + 1 : 0;
    },

    async listAssignedAddresses(): Promise<DepositAddress[]> {
      const results = await prisma.bitcoinPayDepositAddress.findMany({
        where: { intentId: { not: null } },
      });

      return results as DepositAddress[];
    },

    async createTxObservation(data): Promise<TxObservation> {
      const id = nanoid();
      const now = new Date();

      const created = await prisma.bitcoinPayTxObservation.create({
        data: {
          id,
          txid: data.txid,
          vout: data.vout,
          valueSats: BigInt(data.valueSats),
          confirmations: data.confirmations,
          addressId: data.addressId,
          scriptPubKeyHex: data.scriptPubKeyHex,
          status: data.status,
          seenAt: data.seenAt || now,
          updatedAt: now,
        },
      }) as PrismaResult;

      return {
        ...created,
        valueSats: Number(created.valueSats),
      } as TxObservation;
    },

    async upsertTxObservation(data): Promise<TxObservation> {
      const existing = await prisma.bitcoinPayTxObservation.findFirst({
        where: {
          txid: data.txid,
          vout: data.vout,
        },
      }) as PrismaResult | null;

      if (existing) {
        const updated = await prisma.bitcoinPayTxObservation.update({
          where: { id: existing.id as string },
          data: {
            ...data,
            updatedAt: new Date(),
          },
        }) as PrismaResult;

        return {
          ...updated,
          valueSats: Number(updated.valueSats),
        } as TxObservation;
      }

      return await this.createTxObservation(data);
    },

    async getTxObservationsByIntent(intentId): Promise<TxObservation[]> {
      const intent = await prisma.bitcoinPayPaymentIntent.findUnique({
        where: { id: intentId },
      }) as PrismaResult | null;

      if (!intent?.addressId) return [];

      const results = await prisma.bitcoinPayTxObservation.findMany({
        where: { addressId: intent.addressId },
        orderBy: { seenAt: "desc" },
      }) as PrismaResult[];

      return results.map((r) => ({
        ...r,
        valueSats: Number(r.valueSats),
      })) as TxObservation[];
    },

    async getTxObservationByTxid(txid): Promise<TxObservation | null> {
      const result = await prisma.bitcoinPayTxObservation.findFirst({
        where: { txid },
      }) as PrismaResult | null;

      if (!result) return null;

      return {
        ...result,
        valueSats: Number(result.valueSats),
      } as TxObservation;
    },

    async getTxObservationByTxidVout(
      txid,
      vout
    ): Promise<TxObservation | null> {
      const result = await prisma.bitcoinPayTxObservation.findFirst({
        where: { txid, vout },
      }) as PrismaResult | null;

      if (!result) return null;

      return {
        ...result,
        valueSats: Number(result.valueSats),
      } as TxObservation;
    },

    async updateTxObservation(id, data): Promise<TxObservation> {
      const updated = await prisma.bitcoinPayTxObservation.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      }) as PrismaResult;

      return {
        ...updated,
        valueSats: Number(updated.valueSats),
      } as TxObservation;
    },

    async listPendingTxObservations(): Promise<TxObservation[]> {
      const results = await prisma.bitcoinPayTxObservation.findMany({
        where: { status: "mempool" },
        orderBy: { seenAt: "asc" },
      }) as PrismaResult[];

      return results.map((r) => ({
        ...r,
        valueSats: Number(r.valueSats),
      })) as TxObservation[];
    },

    async createMagicLinkToken(data): Promise<MagicLinkToken> {
      const id = nanoid();
      const now = new Date();

      const created = await prisma.bitcoinPayMagicLinkToken.create({
        data: {
          id,
          token: data.token,
          intentId: data.intentId,
          consumed: data.consumed || false,
          expiresAt: data.expiresAt,
          createdAt: now,
        },
      });

      return created as MagicLinkToken;
    },

    async getMagicLinkToken(token): Promise<MagicLinkToken | null> {
      const result = await prisma.bitcoinPayMagicLinkToken.findUnique({
        where: { token },
      });

      return (result as MagicLinkToken) || null;
    },

    async consumeMagicLinkToken(id): Promise<void> {
      await prisma.bitcoinPayMagicLinkToken.update({
        where: { id },
        data: { consumed: true },
      });
    },

    async createCustomer(data): Promise<Customer> {
      const id = nanoid();
      const now = new Date();

      const created = await prisma.bitcoinPayCustomer.create({
        data: {
          id,
          email: data.email ?? null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          createdAt: now,
          updatedAt: now,
        },
      }) as PrismaResult;

      return {
        ...created,
        metadata: created.metadata ? JSON.parse(created.metadata) : undefined,
      } as Customer;
    },

    async getCustomer(id): Promise<Customer | null> {
      const result = await prisma.bitcoinPayCustomer.findUnique({
        where: { id },
      }) as PrismaResult | null;

      if (!result) return null;

      return {
        ...result,
        metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
      } as Customer;
    },

    async getCustomerByEmail(email): Promise<Customer | null> {
      const result = await prisma.bitcoinPayCustomer.findUnique({
        where: { email },
      }) as PrismaResult | null;

      if (!result) return null;

      return {
        ...result,
        metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
      } as Customer;
    },

    async updateCustomer(id, data): Promise<Customer> {
      const updated = await prisma.bitcoinPayCustomer.update({
        where: { id },
        data: {
          ...data,
          metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
          updatedAt: new Date(),
        },
      }) as PrismaResult;

      return {
        ...updated,
        metadata: updated.metadata ? JSON.parse(updated.metadata) : undefined,
      } as Customer;
    },
  };
}
