import { nanoid } from "nanoid";
import type { StorageAdapter } from "../../types/adapter.js";
import type {
  PaymentIntent,
  DepositAddress,
  TxObservation,
  MagicLinkToken,
  Customer,
} from "../../types/models.js";
import type {
  SubscriptionPlan,
  Subscription,
} from "../../types/subscription.js";

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
  bitcoinPaySubscriptionPlan: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    upsert: (args: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args?: { where?: Record<string, unknown> }) => Promise<unknown[]>;
  };
  bitcoinPaySubscription: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findUnique: (args: { where: { id: string } }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: { where: Record<string, unknown> }) => Promise<unknown[]>;
  };
  bitcoinPaySystemMetadata: {
    findUnique: (args: { where: { key: string } }) => Promise<unknown>;
    upsert: (args: { where: { key: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
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

    // Subscription Plans
    async createSubscriptionPlan(plan): Promise<SubscriptionPlan> {
      const now = new Date();
      const created = await prisma.bitcoinPaySubscriptionPlan.create({
        data: {
          id: plan.id,
          name: plan.name,
          description: plan.description ?? null,
          amountSats: BigInt(plan.amountSats),
          currency: plan.currency || "BTC",
          interval: plan.interval,
          intervalCount: plan.intervalCount || 1,
          maxCycles: plan.maxCycles ?? null,
          trialDays: plan.trialDays ?? null,
          metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
          active: plan.active ?? true,
          createdAt: now,
          updatedAt: now,
        },
      }) as PrismaResult;

      return {
        ...created,
        amountSats: Number(created.amountSats),
        metadata: created.metadata ? JSON.parse(created.metadata as string) : null,
      } as SubscriptionPlan;
    },

    async getSubscriptionPlan(planId): Promise<SubscriptionPlan | null> {
      const result = await prisma.bitcoinPaySubscriptionPlan.findUnique({
        where: { id: planId },
      }) as PrismaResult | null;

      if (!result) return null;

      return {
        ...result,
        amountSats: Number(result.amountSats),
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      } as SubscriptionPlan;
    },

    async updateSubscriptionPlan(planId, updates): Promise<SubscriptionPlan> {
      const updated = await prisma.bitcoinPaySubscriptionPlan.update({
        where: { id: planId },
        data: {
          ...updates,
          metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined,
          updatedAt: new Date(),
        },
      }) as PrismaResult;

      return {
        ...updated,
        amountSats: Number(updated.amountSats),
        metadata: updated.metadata ? JSON.parse(updated.metadata as string) : null,
      } as SubscriptionPlan;
    },

    async upsertSubscriptionPlan(plan): Promise<SubscriptionPlan> {
      const now = new Date();
      const upserted = await prisma.bitcoinPaySubscriptionPlan.upsert({
        where: { id: plan.id },
        create: {
          id: plan.id,
          name: plan.name,
          description: plan.description ?? null,
          amountSats: BigInt(plan.amountSats),
          currency: "BTC",
          interval: plan.interval,
          intervalCount: plan.intervalCount || 1,
          maxCycles: plan.maxCycles ?? null,
          trialDays: plan.trialDays ?? null,
          metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
          active: true,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          name: plan.name,
          description: plan.description ?? null,
          amountSats: BigInt(plan.amountSats),
          interval: plan.interval,
          intervalCount: plan.intervalCount || 1,
          maxCycles: plan.maxCycles ?? null,
          trialDays: plan.trialDays ?? null,
          metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
          updatedAt: now,
        },
      }) as PrismaResult;

      return {
        ...upserted,
        amountSats: Number(upserted.amountSats),
        metadata: upserted.metadata ? JSON.parse(upserted.metadata as string) : null,
      } as SubscriptionPlan;
    },

    async listSubscriptionPlans(activeOnly): Promise<SubscriptionPlan[]> {
      const results = await prisma.bitcoinPaySubscriptionPlan.findMany({
        where: activeOnly ? { active: true } : undefined,
      }) as PrismaResult[];

      return results.map((result) => ({
        ...result,
        amountSats: Number(result.amountSats),
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      })) as SubscriptionPlan[];
    },

    // Subscriptions
    async createSubscription(subscription): Promise<Subscription> {
      const id = nanoid();
      const now = new Date();

      const created = await prisma.bitcoinPaySubscription.create({
        data: {
          id,
          planId: subscription.planId,
          customerId: subscription.customerId ?? null,
          customerEmail: subscription.customerEmail ?? null,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialStart: subscription.trialStart ?? null,
          trialEnd: subscription.trialEnd ?? null,
          cyclesCompleted: subscription.cyclesCompleted || 0,
          lastPaymentIntentId: subscription.lastPaymentIntentId ?? null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
          canceledAt: subscription.canceledAt ?? null,
          cancelReason: subscription.cancelReason ?? null,
          metadata: subscription.metadata ? JSON.stringify(subscription.metadata) : null,
          createdAt: now,
          updatedAt: now,
        },
      }) as PrismaResult;

      return {
        ...created,
        metadata: created.metadata ? JSON.parse(created.metadata as string) : null,
      } as Subscription;
    },

    async getSubscription(subscriptionId): Promise<Subscription | null> {
      const result = await prisma.bitcoinPaySubscription.findUnique({
        where: { id: subscriptionId },
      }) as PrismaResult | null;

      if (!result) return null;

      return {
        ...result,
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      } as Subscription;
    },

    async updateSubscription(subscriptionId, updates): Promise<Subscription> {
      const updated = await prisma.bitcoinPaySubscription.update({
        where: { id: subscriptionId },
        data: {
          ...updates,
          metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined,
          updatedAt: new Date(),
        },
      }) as PrismaResult;

      return {
        ...updated,
        metadata: updated.metadata ? JSON.parse(updated.metadata as string) : null,
      } as Subscription;
    },

    async listSubscriptions(filters): Promise<Subscription[]> {
      const where: Record<string, unknown> = {};

      if (filters.customerId) {
        where.customerId = filters.customerId;
      }
      if (filters.status) {
        where.status = Array.isArray(filters.status)
          ? { in: filters.status }
          : filters.status;
      }
      if (filters.planId) {
        where.planId = filters.planId;
      }
      if (filters.currentPeriodEndBefore) {
        where.currentPeriodEnd = { lte: filters.currentPeriodEndBefore };
      }
      if (filters.currentPeriodEndAfter) {
        where.currentPeriodEnd = { gte: filters.currentPeriodEndAfter };
      }

      const results = await prisma.bitcoinPaySubscription.findMany({
        where,
      }) as PrismaResult[];

      return results.map((result) => ({
        ...result,
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      })) as Subscription[];
    },

    async getSubscriptionsNeedingRenewal(beforeDate): Promise<Subscription[]> {
      const results = await prisma.bitcoinPaySubscription.findMany({
        where: {
          status: { in: ["active", "trialing"] },
          currentPeriodEnd: { lte: beforeDate },
          cancelAtPeriodEnd: false,
        },
      }) as PrismaResult[];

      return results.map((result) => ({
        ...result,
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      })) as Subscription[];
    },

    async getOverdueSubscriptions(gracePeriodDays): Promise<Subscription[]> {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() - gracePeriodDays);

      const results = await prisma.bitcoinPaySubscription.findMany({
        where: {
          status: "past_due",
          currentPeriodEnd: { lte: gracePeriodEnd },
        },
      }) as PrismaResult[];

      return results.map((result) => ({
        ...result,
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      })) as Subscription[];
    },

    // System metadata
    async getMetadata(key): Promise<string | null> {
      const result = await prisma.bitcoinPaySystemMetadata.findUnique({
        where: { key },
      }) as { value: string } | null;

      return result?.value ?? null;
    },

    async setMetadata(key, value): Promise<void> {
      await prisma.bitcoinPaySystemMetadata.upsert({
        where: { key },
        create: {
          key,
          value,
          updatedAt: new Date(),
        },
        update: {
          value,
          updatedAt: new Date(),
        },
      });
    },
  };
}
