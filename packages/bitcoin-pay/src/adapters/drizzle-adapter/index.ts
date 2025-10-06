import { eq, and, isNull, desc, asc, sql, inArray, lte } from "drizzle-orm";
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
  CreateSubscriptionPlanInput,
  SubscriptionFilters,
} from "../../types/subscription.js";
import {
  paymentIntents,
  depositAddresses,
  txObservations,
  magicLinkTokens,
  customers,
  subscriptionPlans,
  subscriptions,
  systemMetadata,
} from "./schema.js";

export * from "./schema.js";

interface DrizzleSelectBuilder {
  from: (table: unknown) => DrizzleFromBuilder;
}

interface DrizzleFromBuilder {
  where: (condition: unknown) => DrizzleWhereBuilder;
  limit: (n: number) => Promise<unknown[]>;
  orderBy: (order: unknown) => Promise<unknown[]>;
}

interface DrizzleWhereBuilder {
  limit: (n: number) => Promise<unknown[]>;
  orderBy: (order: unknown) => Promise<unknown[]>;
}

interface DrizzleDB {
  insert: (table: unknown) => { values: (data: unknown) => Promise<unknown> };
  select: (fields?: unknown) => DrizzleSelectBuilder;
  update: (table: unknown) => {
    set: (data: unknown) => {
      where: (condition: unknown) => Promise<unknown>;
    };
  };
}

interface DrizzleResult {
  amountSats?: bigint | number;
  valueSats?: bigint | number;
  metadata?: string | null;
  [key: string]: unknown;
}

export function drizzleAdapter(db: DrizzleDB): StorageAdapter {

  return {
    async createPaymentIntent(data): Promise<PaymentIntent> {
      const id = nanoid();
      const now = new Date();

      const values = {
        id,
        customerId: data.customerId ?? null,
        email: data.email ?? null,
        amountSats: data.amountSats,
        status: data.status,
        addressId: data.addressId ?? null,
        memo: data.memo ?? null,
        requiredConfs: data.requiredConfs || 1,
        expiresAt: data.expiresAt,
        confirmedAt: data.confirmedAt ?? null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(paymentIntents).values(values);

      return {
        ...values,
        amountSats: Number(values.amountSats),
        requiredConfs: values.requiredConfs,
      } as PaymentIntent;
    },

    async getPaymentIntent(id): Promise<PaymentIntent | null> {
      const result = await db
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, id))
        .limit(1) as DrizzleResult[];

      if (!result[0]) return null;

      return {
        ...result[0],
        amountSats: Number(result[0].amountSats),
      } as PaymentIntent;
    },

    async updatePaymentIntent(id, data): Promise<PaymentIntent> {
      const updates = {
        ...data,
        updatedAt: new Date(),
      };

      await db
        .update(paymentIntents)
        .set(updates)
        .where(eq(paymentIntents.id, id));

      const updated = await db
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, id))
        .limit(1) as DrizzleResult[];

      return {
        ...updated[0],
        amountSats: Number(updated[0].amountSats),
      } as PaymentIntent;
    },

    async listPaymentIntentsByStatus(status): Promise<PaymentIntent[]> {
      const results = await db
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.status, status))
        .orderBy(desc(paymentIntents.createdAt)) as DrizzleResult[];

      return results.map((r) => ({
        ...r,
        amountSats: Number(r.amountSats),
      })) as PaymentIntent[];
    },

    async createDepositAddress(data): Promise<DepositAddress> {
      const id = nanoid();
      const now = new Date();

      const values = {
        id,
        address: data.address,
        derivationIndex: data.derivationIndex,
        scriptPubKeyHex: data.scriptPubKeyHex,
        intentId: data.intentId ?? null,
        assignedAt: data.assignedAt ?? null,
        createdAt: now,
      };

      await db.insert(depositAddresses).values(values);

      return values as DepositAddress;
    },

    async getDepositAddress(id): Promise<DepositAddress | null> {
      const result = await db
        .select()
        .from(depositAddresses)
        .where(eq(depositAddresses.id, id))
        .limit(1) as DepositAddress[];

      return result[0] || null;
    },

    async getDepositAddressByAddress(address): Promise<DepositAddress | null> {
      const result = await db
        .select()
        .from(depositAddresses)
        .where(eq(depositAddresses.address, address))
        .limit(1) as DepositAddress[];

      return result[0] || null;
    },

    async getUnassignedAddress(): Promise<DepositAddress | null> {
      const result = await db
        .select()
        .from(depositAddresses)
        .where(isNull(depositAddresses.intentId))
        .orderBy(asc(depositAddresses.derivationIndex)) as DepositAddress[];

      return result[0] || null;
    },

    async assignAddressToIntent(
      addressId,
      intentId,
    ): Promise<DepositAddress> {
      const now = new Date();

      await db
        .update(depositAddresses)
        .set({ intentId, assignedAt: now })
        .where(eq(depositAddresses.id, addressId));

      await db
        .update(paymentIntents)
        .set({ addressId, updatedAt: now })
        .where(eq(paymentIntents.id, intentId));

      const updated = await db
        .select()
        .from(depositAddresses)
        .where(eq(depositAddresses.id, addressId))
        .limit(1) as DepositAddress[];

      return updated[0] as DepositAddress;
    },

    async getNextDerivationIndex(): Promise<number> {
      const result = await db
        .select({ maxIndex: sql<number>`MAX(${depositAddresses.derivationIndex})` })
        .from(depositAddresses)
        .limit(1000) as { maxIndex: number | null }[];

      const maxIndex = result[0]?.maxIndex;
      return maxIndex !== null && maxIndex !== undefined ? maxIndex + 1 : 0;
    },

    async listAssignedAddresses(): Promise<DepositAddress[]> {
      const results = await db
        .select()
        .from(depositAddresses)
        .where(sql`${depositAddresses.intentId} IS NOT NULL`)
        .limit(10000) as DepositAddress[];

      return results;
    },

    async createTxObservation(data): Promise<TxObservation> {
      const id = nanoid();
      const now = new Date();

      const values = {
        id,
        txid: data.txid,
        vout: data.vout,
        valueSats: data.valueSats,
        confirmations: data.confirmations,
        addressId: data.addressId,
        scriptPubKeyHex: data.scriptPubKeyHex,
        status: data.status,
        seenAt: data.seenAt || now,
        updatedAt: now,
      };

      await db.insert(txObservations).values(values);

      return {
        ...values,
        valueSats: Number(values.valueSats),
      } as TxObservation;
    },

    async upsertTxObservation(data): Promise<TxObservation> {
      const existing = await db
        .select()
        .from(txObservations)
        .where(
          and(
            eq(txObservations.txid, data.txid),
            eq(txObservations.vout, data.vout),
          ),
        )
        .limit(1) as DrizzleResult[];

      if (existing[0]) {
        await db
          .update(txObservations)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(txObservations.id, existing[0].id as string));

        const updated = await db
          .select()
          .from(txObservations)
          .where(eq(txObservations.id, existing[0].id as string))
          .limit(1) as DrizzleResult[];

        return {
          ...updated[0],
          valueSats: Number(updated[0].valueSats),
        } as TxObservation;
      }

      return await this.createTxObservation(data);
    },

    async getTxObservationsByIntent(intentId): Promise<TxObservation[]> {
      const intent = await db
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, intentId))
        .limit(1) as DrizzleResult[];

      if (!intent[0]?.addressId) return [];

      const results = await db
        .select()
        .from(txObservations)
        .where(eq(txObservations.addressId, intent[0].addressId as string))
        .orderBy(desc(txObservations.seenAt)) as DrizzleResult[];

      return results.map((r) => ({
        ...r,
        valueSats: Number(r.valueSats),
      })) as TxObservation[];
    },

    async getTxObservationByTxid(txid): Promise<TxObservation | null> {
      const result = await db
        .select()
        .from(txObservations)
        .where(eq(txObservations.txid, txid))
        .limit(1) as DrizzleResult[];

      if (!result[0]) return null;

      return {
        ...result[0],
        valueSats: Number(result[0].valueSats),
      } as TxObservation;
    },

    async getTxObservationByTxidVout(
      txid,
      vout,
    ): Promise<TxObservation | null> {
      const result = await db
        .select()
        .from(txObservations)
        .where(
          and(eq(txObservations.txid, txid), eq(txObservations.vout, vout)),
        )
        .limit(1) as DrizzleResult[];

      if (!result[0]) return null;

      return {
        ...result[0],
        valueSats: Number(result[0].valueSats),
      } as TxObservation;
    },

    async updateTxObservation(id, data): Promise<TxObservation> {
      const updates = {
        ...data,
        updatedAt: new Date(),
      };

      await db
        .update(txObservations)
        .set(updates)
        .where(eq(txObservations.id, id));

      const updated = await db
        .select()
        .from(txObservations)
        .where(eq(txObservations.id, id))
        .limit(1) as DrizzleResult[];

      return {
        ...updated[0],
        valueSats: Number(updated[0].valueSats),
      } as TxObservation;
    },

    async listPendingTxObservations(): Promise<TxObservation[]> {
      const results = await db
        .select()
        .from(txObservations)
        .where(eq(txObservations.status, "mempool"))
        .orderBy(asc(txObservations.seenAt)) as DrizzleResult[];

      return results.map((r) => ({
        ...r,
        valueSats: Number(r.valueSats),
      })) as TxObservation[];
    },

    async createMagicLinkToken(data): Promise<MagicLinkToken> {
      const id = nanoid();
      const now = new Date();

      const values = {
        id,
        token: data.token,
        intentId: data.intentId,
        consumed: data.consumed || false,
        expiresAt: data.expiresAt,
        createdAt: now,
      };

      await db.insert(magicLinkTokens).values(values);

      return values as MagicLinkToken;
    },

    async getMagicLinkToken(token): Promise<MagicLinkToken | null> {
      const result = await db
        .select()
        .from(magicLinkTokens)
        .where(eq(magicLinkTokens.token, token))
        .limit(1) as MagicLinkToken[];

      return result[0] || null;
    },

    async consumeMagicLinkToken(id): Promise<void> {
      await db
        .update(magicLinkTokens)
        .set({ consumed: true })
        .where(eq(magicLinkTokens.id, id));
    },

    async createCustomer(data): Promise<Customer> {
      const id = nanoid();
      const now = new Date();

      const values = {
        id,
        email: data.email ?? null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(customers).values(values);

      return {
        ...values,
        metadata: values.metadata ? JSON.parse(values.metadata) : undefined,
      } as Customer;
    },

    async getCustomer(id): Promise<Customer | null> {
      const result = await db
        .select()
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1) as DrizzleResult[];

      if (!result[0]) return null;

      return {
        ...result[0],
        metadata: result[0].metadata ? JSON.parse(result[0].metadata as string) : undefined,
      } as Customer;
    },

    async getCustomerByEmail(email): Promise<Customer | null> {
      const result = await db
        .select()
        .from(customers)
        .where(eq(customers.email, email))
        .limit(1) as DrizzleResult[];

      if (!result[0]) return null;

      return {
        ...result[0],
        metadata: result[0].metadata ? JSON.parse(result[0].metadata as string) : undefined,
      } as Customer;
    },

    async updateCustomer(id, data): Promise<Customer> {
      const updates = {
        ...data,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        updatedAt: new Date(),
      };

      await db.update(customers).set(updates).where(eq(customers.id, id));

      const updated = await db
        .select()
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1) as DrizzleResult[];

      return {
        ...updated[0],
        metadata: updated[0].metadata ? JSON.parse(updated[0].metadata as string) : undefined,
      } as Customer;
    },

    // Subscription Plans
    async createSubscriptionPlan(plan): Promise<SubscriptionPlan> {
      const now = new Date();
      await db.insert(subscriptionPlans).values({
        id: plan.id,
        name: plan.name,
        description: plan.description ?? null,
        amountSats: plan.amountSats,
        currency: plan.currency || "BTC",
        interval: plan.interval,
        intervalCount: plan.intervalCount || 1,
        maxCycles: plan.maxCycles ?? null,
        trialDays: plan.trialDays ?? null,
        metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
        active: plan.active ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      });

      const created = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, plan.id))
        .limit(1) as DrizzleResult[];

      return {
        ...created[0],
        active: created[0].active === 1,
        metadata: created[0].metadata ? JSON.parse(created[0].metadata as string) : null,
      } as SubscriptionPlan;
    },

    async getSubscriptionPlan(planId): Promise<SubscriptionPlan | null> {
      const result = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1) as DrizzleResult[];

      if (!result[0]) return null;

      return {
        ...result[0],
        active: result[0].active === 1,
        metadata: result[0].metadata ? JSON.parse(result[0].metadata as string) : null,
      } as SubscriptionPlan;
    },

    async updateSubscriptionPlan(planId, updates): Promise<SubscriptionPlan> {
      const data = {
        ...updates,
        metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined,
        active: updates.active !== undefined ? (updates.active ? 1 : 0) : undefined,
        updatedAt: new Date(),
      };

      await db.update(subscriptionPlans).set(data).where(eq(subscriptionPlans.id, planId));

      const updated = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1) as DrizzleResult[];

      return {
        ...updated[0],
        active: updated[0].active === 1,
        metadata: updated[0].metadata ? JSON.parse(updated[0].metadata as string) : null,
      } as SubscriptionPlan;
    },

    async upsertSubscriptionPlan(plan): Promise<SubscriptionPlan> {
      const now = new Date();
      const existing = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, plan.id))
        .limit(1) as DrizzleResult[];

      if (existing[0]) {
        // Update
        await db.update(subscriptionPlans).set({
          name: plan.name,
          description: plan.description ?? null,
          amountSats: plan.amountSats,
          interval: plan.interval,
          intervalCount: plan.intervalCount || 1,
          maxCycles: plan.maxCycles ?? null,
          trialDays: plan.trialDays ?? null,
          metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
          updatedAt: now,
        }).where(eq(subscriptionPlans.id, plan.id));
      } else {
        // Insert
        await db.insert(subscriptionPlans).values({
          id: plan.id,
          name: plan.name,
          description: plan.description ?? null,
          amountSats: plan.amountSats,
          currency: "BTC",
          interval: plan.interval,
          intervalCount: plan.intervalCount || 1,
          maxCycles: plan.maxCycles ?? null,
          trialDays: plan.trialDays ?? null,
          metadata: plan.metadata ? JSON.stringify(plan.metadata) : null,
          active: 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      const result = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, plan.id))
        .limit(1) as DrizzleResult[];

      return {
        ...result[0],
        active: result[0].active === 1,
        metadata: result[0].metadata ? JSON.parse(result[0].metadata as string) : null,
      } as SubscriptionPlan;
    },

    async listSubscriptionPlans(activeOnly): Promise<SubscriptionPlan[]> {
      let query = db.select().from(subscriptionPlans);

      if (activeOnly) {
        query = query.where(eq(subscriptionPlans.active, 1)) as typeof query;
      }

      const results = await query as unknown as DrizzleResult[];

      return results.map((result) => ({
        ...result,
        active: result.active === 1,
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      })) as SubscriptionPlan[];
    },

    // Subscriptions
    async createSubscription(subscription): Promise<Subscription> {
      const id = nanoid();
      const now = new Date();

      await db.insert(subscriptions).values({
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
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ? 1 : 0,
        canceledAt: subscription.canceledAt ?? null,
        cancelReason: subscription.cancelReason ?? null,
        metadata: subscription.metadata ? JSON.stringify(subscription.metadata) : null,
        createdAt: now,
        updatedAt: now,
      });

      const created = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
        .limit(1) as DrizzleResult[];

      return {
        ...created[0],
        cancelAtPeriodEnd: created[0].cancelAtPeriodEnd === 1,
        metadata: created[0].metadata ? JSON.parse(created[0].metadata as string) : null,
      } as Subscription;
    },

    async getSubscription(subscriptionId): Promise<Subscription | null> {
      const result = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1) as DrizzleResult[];

      if (!result[0]) return null;

      return {
        ...result[0],
        cancelAtPeriodEnd: result[0].cancelAtPeriodEnd === 1,
        metadata: result[0].metadata ? JSON.parse(result[0].metadata as string) : null,
      } as Subscription;
    },

    async updateSubscription(subscriptionId, updates): Promise<Subscription> {
      const data = {
        ...updates,
        metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined,
        cancelAtPeriodEnd: updates.cancelAtPeriodEnd !== undefined ? (updates.cancelAtPeriodEnd ? 1 : 0) : undefined,
        updatedAt: new Date(),
      };

      await db.update(subscriptions).set(data).where(eq(subscriptions.id, subscriptionId));

      const updated = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1) as DrizzleResult[];

      return {
        ...updated[0],
        cancelAtPeriodEnd: updated[0].cancelAtPeriodEnd === 1,
        metadata: updated[0].metadata ? JSON.parse(updated[0].metadata as string) : null,
      } as Subscription;
    },

    async listSubscriptions(filters): Promise<Subscription[]> {
      const conditions: ReturnType<typeof eq>[] = [];

      if (filters.customerId) {
        conditions.push(eq(subscriptions.customerId, filters.customerId));
      }
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          conditions.push(inArray(subscriptions.status, filters.status));
        } else {
          conditions.push(eq(subscriptions.status, filters.status));
        }
      }
      if (filters.planId) {
        conditions.push(eq(subscriptions.planId, filters.planId));
      }
      if (filters.currentPeriodEndBefore) {
        conditions.push(lte(subscriptions.currentPeriodEnd, filters.currentPeriodEndBefore));
      }
      if (filters.currentPeriodEndAfter) {
        conditions.push(sql`${subscriptions.currentPeriodEnd} >= ${filters.currentPeriodEndAfter}`);
      }

      let query = db.select().from(subscriptions);

      if (conditions.length > 0) {
        query = query.where(and(...conditions as Parameters<typeof and>)) as typeof query;
      }

      const results = await query as unknown as DrizzleResult[];

      return results.map((result) => ({
        ...result,
        cancelAtPeriodEnd: result.cancelAtPeriodEnd === 1,
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      })) as Subscription[];
    },

    async getSubscriptionsNeedingRenewal(beforeDate): Promise<Subscription[]> {
      const results = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            inArray(subscriptions.status, ["active", "trialing"]),
            lte(subscriptions.currentPeriodEnd, beforeDate),
            eq(subscriptions.cancelAtPeriodEnd, 0)
          )
        ) as unknown as DrizzleResult[];

      return results.map((result) => ({
        ...result,
        cancelAtPeriodEnd: result.cancelAtPeriodEnd === 1,
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      })) as Subscription[];
    },

    async getOverdueSubscriptions(gracePeriodDays): Promise<Subscription[]> {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() - gracePeriodDays);

      const results = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "past_due"),
            lte(subscriptions.currentPeriodEnd, gracePeriodEnd)
          )
        ) as unknown as DrizzleResult[];

      return results.map((result) => ({
        ...result,
        cancelAtPeriodEnd: result.cancelAtPeriodEnd === 1,
        metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
      })) as Subscription[];
    },

    // System metadata
    async getMetadata(key): Promise<string | null> {
      const result = await db
        .select()
        .from(systemMetadata)
        .where(eq(systemMetadata.key, key))
        .limit(1) as { value: string }[];

      return result[0]?.value ?? null;
    },

    async setMetadata(key, value): Promise<void> {
      const existing = await db
        .select()
        .from(systemMetadata)
        .where(eq(systemMetadata.key, key))
        .limit(1);

      if (existing[0]) {
        await db.update(systemMetadata).set({
          value,
          updatedAt: new Date(),
        }).where(eq(systemMetadata.key, key));
      } else {
        await db.insert(systemMetadata).values({
          key,
          value,
          updatedAt: new Date(),
        });
      }
    },
  };
}
