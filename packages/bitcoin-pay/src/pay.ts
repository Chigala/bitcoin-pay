import type { BitcoinPayOptions } from "./types";
import type { PaymentIntent, DepositAddress } from "./types/models";
import type {
  Subscription,
  SubscriptionPlan,
  CreateSubscriptionInput,
  SubscriptionFilters,
} from "./types/subscription";
import {
  parseDescriptor,
  deriveAddress,
  createBIP21URI,
} from "./crypto/descriptor";
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
} from "./crypto/magic-link";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";

export interface BitcoinPayContext {
  options: Required<BitcoinPayOptions>;
  parsedDescriptor: ReturnType<typeof parseDescriptor>;
}

export const createBitcoinPay = (options: BitcoinPayOptions) => {
  const fullOptions: Required<BitcoinPayOptions> = {
    network: options.network || "mainnet",
    baseURL: options.baseURL,
    secret: options.secret,
    descriptor: options.descriptor,
    storage: options.storage,
    confirmations: options.confirmations || 1,
    basePath: options.basePath || "/api/pay",
    events: options.events || {},
    plugins: options.plugins || [],
    subscriptions: options.subscriptions || {
      plans: [],
      autoSync: true,
      gracePeriodDays: 3,
    },
    advanced: {
      gapLimit: options.advanced?.gapLimit || 20,
      magicLinkTTL: options.advanced?.magicLinkTTL || 86400,
      intentExpiryMinutes: options.advanced?.intentExpiryMinutes || 60,
    },
  };

  const parsedDescriptor = parseDescriptor(
    fullOptions.descriptor,
    fullOptions.network
  );

  const context: BitcoinPayContext = {
    options: fullOptions,
    parsedDescriptor,
  };

  // Sync subscription plans if configured
  if (
    fullOptions.subscriptions.autoSync !== false &&
    fullOptions.subscriptions.plans.length > 0
  ) {
    if (
      fullOptions.storage.upsertSubscriptionPlan &&
      fullOptions.storage.getMetadata &&
      fullOptions.storage.setMetadata
    ) {
      // Hash the plans config
      const plansHash = createHash("sha256")
        .update(JSON.stringify(fullOptions.subscriptions.plans))
        .digest("hex");

      // Sync plans asynchronously (don't block initialization)
      (async () => {
        try {
          if (
            !fullOptions.storage.getMetadata ||
            !fullOptions.storage.upsertSubscriptionPlan ||
            !fullOptions.storage.setMetadata
          ) {
            return;
          }

          const lastHash = await fullOptions.storage.getMetadata(
            "subscription_plans_hash"
          );

          if (plansHash !== lastHash) {
            // Sync all plans
            for (const planConfig of fullOptions.subscriptions.plans) {
              await fullOptions.storage.upsertSubscriptionPlan(planConfig);
            }

            await fullOptions.storage.setMetadata(
              "subscription_plans_hash",
              plansHash
            );
          }
        } catch (error) {
          console.error(
            "[BitcoinPay] Failed to sync subscription plans:",
            error
          );
        }
      })();
    }
  }

  async function createPaymentIntent(data: {
    email?: string;
    customerId?: string;
    amountSats: number;
    memo?: string;
    expiresInMinutes?: number;
    requiredConfs?: number;
  }): Promise<PaymentIntent> {
    const expiryMins: number = (data.expiresInMinutes ??
      fullOptions.advanced.intentExpiryMinutes) as number;
    const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);

    const intent = await fullOptions.storage.createPaymentIntent({
      customerId: data.customerId ?? null,
      email: data.email ?? null,
      amountSats: data.amountSats,
      status: "pending",
      addressId: null,
      memo: data.memo ?? null,
      requiredConfs: data.requiredConfs || fullOptions.confirmations,
      expiresAt,
      confirmedAt: null,
    });

    return intent;
  }

  async function createMagicLink(data: {
    intentId: string;
    ttlHours?: number;
  }): Promise<{ url: string; token: string }> {
    const ttlSeconds = (data.ttlHours || 24) * 3600;
    const nonce = nanoid();

    const token = createMagicLinkToken(
      { intentId: data.intentId, nonce },
      fullOptions.secret,
      ttlSeconds
    );

    await fullOptions.storage.createMagicLinkToken({
      token,
      intentId: data.intentId,
      consumed: false,
      consumedAt: null,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });

    const url = `${fullOptions.baseURL}${fullOptions.basePath}/pay/${token}`;
    return { url, token };
  }

  async function verifyMagicLink(data: {
    token: string;
  }): Promise<{ intentId: string }> {
    const payload = verifyMagicLinkToken(data.token, fullOptions.secret);

    if (!payload) {
      throw new Error("Invalid or expired token");
    }

    const tokenRecord = await fullOptions.storage.getMagicLinkToken(data.token);
    if (!tokenRecord) {
      throw new Error("Token not found");
    }
    if (tokenRecord.expiresAt < new Date()) {
      throw new Error("Token expired");
    }

    // Idempotent: mark consumed on first use; allow subsequent uses until expiry
    if (!tokenRecord.consumed) {
      await fullOptions.storage.consumeMagicLinkToken(tokenRecord.id);
    }

    return { intentId: payload.intentId };
  }

  async function ensureAssigned(intentId: string): Promise<{
    intentId: string;
    address: string;
    bip21: string;
    amountSats: number;
    expiresAt: Date;
    status: string;
  }> {
    const intent = await fullOptions.storage.getPaymentIntent(intentId);

    if (!intent) {
      throw new Error("Payment intent not found");
    }

    let depositAddress: DepositAddress | null = null;

    if (intent.addressId) {
      depositAddress = await fullOptions.storage.getDepositAddress(
        intent.addressId
      );
    }

    if (!depositAddress) {
      depositAddress = await fullOptions.storage.getUnassignedAddress();

      if (!depositAddress) {
        const nextIndex = await fullOptions.storage.getNextDerivationIndex();
        const derived = deriveAddress(parsedDescriptor, nextIndex);

        depositAddress = await fullOptions.storage.createDepositAddress({
          address: derived.address,
          derivationIndex: nextIndex,
          scriptPubKeyHex: derived.scriptPubKey.toString("hex"),
          intentId: null,
          assignedAt: null,
        });
      }

      depositAddress = await fullOptions.storage.assignAddressToIntent(
        depositAddress.id,
        intentId
      );
      await fullOptions.storage.updatePaymentIntent(intentId, {
        addressId: depositAddress.id,
      });
    }

    const bip21 = createBIP21URI(
      depositAddress.address,
      intent.amountSats,
      intent.memo || undefined
    );

    return {
      intentId: intent.id,
      address: depositAddress.address,
      bip21,
      amountSats: intent.amountSats,
      expiresAt: intent.expiresAt,
      status: intent.status,
    };
  }

  async function getIntent(intentId: string): Promise<PaymentIntent | null> {
    return fullOptions.storage.getPaymentIntent(intentId);
  }

  async function expireStaleIntents(): Promise<void> {
    const pending = await fullOptions.storage.listPaymentIntentsByStatus(
      "pending"
    );
    const now = new Date();

    for (const intent of pending) {
      if (intent.expiresAt < now) {
        await fullOptions.storage.updatePaymentIntent(intent.id, {
          status: "expired",
        });

        if (fullOptions.events.onExpired) {
          await fullOptions.events.onExpired({ intentId: intent.id });
        }
      }
    }
  }

  async function migrate(): Promise<void> {
    console.log(
      "Migration stub - please add schema tables to your database manually"
    );
  }

  async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(fullOptions.basePath, "");

    try {
      if (path.startsWith("/pay/") && request.method === "GET") {
        const token = path.replace("/pay/", "");
        const { intentId } = await verifyMagicLink({ token });
        const data = await ensureAssigned(intentId);

        return Response.json(data);
      }

      if (path === "/status" && request.method === "GET") {
        const intentId = url.searchParams.get("intentId");
        if (!intentId) {
          return Response.json({ error: "Missing intentId" }, { status: 400 });
        }

        const intent = await getIntent(intentId);
        if (!intent) {
          return Response.json({ error: "Intent not found" }, { status: 404 });
        }

        const txs = await fullOptions.storage.getTxObservationsByIntent(
          intentId
        );

        return Response.json({
          status: intent.status,
          amountSats: intent.amountSats,
          expiresAt: intent.expiresAt,
          confirmedAt: intent.confirmedAt,
          confs: txs[0]?.confirmations || 0,
          txid: txs[0]?.txid || null,
          valueSats: txs[0]?.valueSats || null,
        });
      }

      if (path === "/intents" && request.method === "POST") {
        const body: unknown = await request.json();
        const data = body as {
          email?: string;
          customerId?: string;
          amountSats: number;
          memo?: string;
          expiresInMinutes?: number;
          requiredConfs?: number;
        };
        const intent = await createPaymentIntent(data);

        if (fullOptions.events.onIntentCreated) {
          await fullOptions.events.onIntentCreated({ intentId: intent.id });
        }

        return Response.json(intent, { status: 201 });
      }

      if (
        path.match(/^\/intents\/[^/]+\/magic-link$/) &&
        request.method === "POST"
      ) {
        const intentId = path.split("/")[2];
        if (!intentId) {
          return Response.json({ error: "Invalid intent ID" }, { status: 400 });
        }

        const body = (await request.json()) as { ttlHours?: number };
        const { url, token } = await createMagicLink({
          intentId,
          ttlHours: body.ttlHours,
        });

        return Response.json({ url, token });
      }

      if (path.match(/^\/intents\/[^/]+$/) && request.method === "GET") {
        const intentId = path.split("/")[2];
        if (!intentId) {
          return Response.json({ error: "Invalid intent ID" }, { status: 400 });
        }

        const intent = await getIntent(intentId);

        if (!intent) {
          return Response.json({ error: "Intent not found" }, { status: 404 });
        }

        return Response.json(intent);
      }

      if (path.startsWith("/scan/") && request.method === "POST") {
        const intentId = path.replace("/scan/", "");

        // Manual scan endpoint - check payment status via storage
        const intent = await fullOptions.storage.getPaymentIntent(intentId);
        if (!intent) {
          return Response.json({ error: "Intent not found" }, { status: 404 });
        }

        // Return current status - actual scanning should be done via Inngest integration
        return Response.json({
          success: true,
          message: "Use Inngest integration for payment monitoring",
          status: intent.status,
        });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Internal server error";
      const errorStatus = (error as { status?: number }).status || 500;

      console.error("Handler error:", error);
      return Response.json({ error: errorMessage }, { status: errorStatus });
    }
  }

  // Subscription methods
  async function createSubscription(
    data: CreateSubscriptionInput
  ): Promise<Subscription> {
    if (!fullOptions.storage.createSubscription) {
      throw new Error("Storage adapter does not support subscriptions");
    }

    if (!fullOptions.storage.getSubscriptionPlan) {
      throw new Error("Storage adapter does not support getSubscriptionPlan");
    }

    const plan = await fullOptions.storage.getSubscriptionPlan(data.planId);
    if (!plan) {
      throw new Error(`Subscription plan not found: ${data.planId}`);
    }

    if (!plan.active) {
      throw new Error(`Subscription plan is inactive: ${data.planId}`);
    }

    const now = data.startDate || new Date();
    const trialDays = data.trialDays ?? plan.trialDays ?? 0;

    const currentPeriodStart = now;
    let currentPeriodEnd = new Date(now);
    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;
    let status: "trialing" | "active" = "active";

    if (trialDays > 0) {
      status = "trialing";
      trialStart = now;
      trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + trialDays);
      currentPeriodEnd = trialEnd;
    } else {
      // Calculate first billing period end
      switch (plan.interval) {
        case "daily":
          currentPeriodEnd.setDate(
            currentPeriodEnd.getDate() + plan.intervalCount
          );
          break;
        case "weekly":
          currentPeriodEnd.setDate(
            currentPeriodEnd.getDate() + 7 * plan.intervalCount
          );
          break;
        case "monthly":
          currentPeriodEnd.setMonth(
            currentPeriodEnd.getMonth() + plan.intervalCount
          );
          break;
        case "yearly":
          currentPeriodEnd.setFullYear(
            currentPeriodEnd.getFullYear() + plan.intervalCount
          );
          break;
      }
    }

    const subscription = await fullOptions.storage.createSubscription({
      planId: data.planId,
      customerId: data.customerId ?? null,
      customerEmail: data.customerEmail ?? null,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      trialStart,
      trialEnd,
      cyclesCompleted: 0,
      lastPaymentIntentId: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      cancelReason: null,
      metadata: data.metadata ?? null,
    });

    // Create first payment intent (if not in trial)
    if (status === "active") {
      await createPaymentIntent({
        customerId: subscription.customerId ?? undefined,
        email: subscription.customerEmail ?? undefined,
        amountSats: plan.amountSats,
        memo: `Subscription payment - ${plan.name}`,
        requiredConfs: fullOptions.confirmations,
      });
    }

    return subscription;
  }

  async function getSubscription(
    subscriptionId: string
  ): Promise<Subscription | null> {
    if (!fullOptions.storage.getSubscription) {
      throw new Error("Storage adapter does not support subscriptions");
    }
    return fullOptions.storage.getSubscription(subscriptionId);
  }

  async function listSubscriptions(
    filters: SubscriptionFilters = {}
  ): Promise<Subscription[]> {
    if (!fullOptions.storage.listSubscriptions) {
      throw new Error("Storage adapter does not support subscriptions");
    }
    return fullOptions.storage.listSubscriptions(filters);
  }

  async function cancelSubscription(
    subscriptionId: string,
    options: { immediately?: boolean; reason?: string } = {}
  ): Promise<Subscription> {
    if (!fullOptions.storage.updateSubscription) {
      throw new Error("Storage adapter does not support subscriptions");
    }

    const subscription = await getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (
      subscription.status === "canceled" ||
      subscription.status === "expired"
    ) {
      throw new Error(`Subscription is already ${subscription.status}`);
    }

    const updateSubscription = fullOptions.storage.updateSubscription;

    if (options.immediately) {
      return updateSubscription(subscriptionId, {
        status: "canceled",
        canceledAt: new Date(),
        cancelReason: options.reason ?? null,
        cancelAtPeriodEnd: false,
      });
    }

    return updateSubscription(subscriptionId, {
      cancelAtPeriodEnd: true,
      cancelReason: options.reason ?? null,
    });
  }

  async function listSubscriptionPlans(
    activeOnly?: boolean
  ): Promise<SubscriptionPlan[]> {
    if (!fullOptions.storage.listSubscriptionPlans) {
      throw new Error("Storage adapter does not support subscriptions");
    }
    return fullOptions.storage.listSubscriptionPlans(activeOnly);
  }

  async function getSubscriptionPlan(
    planId: string
  ): Promise<SubscriptionPlan | null> {
    if (!fullOptions.storage.getSubscriptionPlan) {
      throw new Error("Storage adapter does not support subscriptions");
    }
    return fullOptions.storage.getSubscriptionPlan(planId);
  }

  return {
    handler,
    createPaymentIntent,
    createMagicLink,
    verifyMagicLink,
    ensureAssigned,
    getIntent,
    expireStaleIntents,
    migrate,
    // Subscription methods
    createSubscription,
    getSubscription,
    listSubscriptions,
    cancelSubscription,
    listSubscriptionPlans,
    getSubscriptionPlan,
    $context: context,
  };
};

export type BitcoinPay = ReturnType<typeof createBitcoinPay>;
