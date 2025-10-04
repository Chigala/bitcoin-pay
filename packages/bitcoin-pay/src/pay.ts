import type { BitcoinPayOptions } from "./types";
import type { PaymentIntent, DepositAddress } from "./types/models";
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
import type { BitcoinWatcher } from "./watcher/index.js";

export interface BitcoinPayContext {
  options: Required<BitcoinPayOptions>;
  parsedDescriptor: ReturnType<typeof parseDescriptor>;
  watcherStarted: boolean;
  watcher?: BitcoinWatcher;
}

export const createBitcoinPay = (options: BitcoinPayOptions) => {
  const fullOptions: Required<BitcoinPayOptions> = {
    network: options.network || "mainnet",
    baseURL: options.baseURL,
    secret: options.secret,
    descriptor: options.descriptor,
    watcher: options.watcher,
    storage: options.storage,
    confirmations: options.confirmations || 1,
    basePath: options.basePath || "/api/pay",
    events: options.events || {},
    plugins: options.plugins || [],
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
    watcherStarted: false,
  };

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

  async function startWatcher(): Promise<void> {
    if (context.watcherStarted) {
      return;
    }

    // Only start watcher if RPC is configured AND at least one ZMQ port is provided.
    const hasRpc = Boolean(fullOptions.watcher?.rpc?.host);
    const zmq = fullOptions.watcher?.zmq as
      | {
          host?: string;
          hashtxPort?: number;
          rawtxPort?: number;
          hashblockPort?: number;
          rawblockPort?: number;
          sequencePort?: number;
        }
      | undefined;
    const hasAnyZmqPort = Boolean(
      zmq &&
        (zmq.hashtxPort ||
          zmq.rawtxPort ||
          zmq.hashblockPort ||
          zmq.rawblockPort ||
          zmq.sequencePort)
    );

    if (!hasRpc || !hasAnyZmqPort) {
      // Gracefully skip starting the watcher; UI will still work and status can be polled/updated later.
      return;
    }

    const { BitcoinWatcher } = await import("./watcher/index.js");

    context.watcher = new BitcoinWatcher(
      {
        // Non-null after guards above
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        zmq: fullOptions.watcher.zmq!,
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        rpc: fullOptions.watcher.rpc!,
        storage: fullOptions.storage,
        network: parsedDescriptor.network,
        confirmations: fullOptions.confirmations,
      },
      {
        onProcessing: async (data) => {
          await fullOptions.events.onProcessing?.(data);
        },
        onConfirmed: async (data) => {
          await fullOptions.events.onConfirmed?.(data);
        },
        onReorg: async (data) => {
          await fullOptions.events.onReorg?.(data);
        },
      }
    );

    await context.watcher.start();
    context.watcherStarted = true;
  }

  async function stopWatcher(): Promise<void> {
    if (!context.watcherStarted || !context.watcher) {
      return;
    }
    await context.watcher.stop();
    context.watcher = undefined;
    context.watcherStarted = false;
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

        if (context.watcher) {
          await context.watcher.addAddress(data.address, intentId);
        }

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

        if (context.watcher) {
          await context.watcher.scanForPayments(intentId);
          return Response.json({ success: true });
        }

        return Response.json({ error: "Watcher not started" }, { status: 503 });
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

  return {
    handler,
    createPaymentIntent,
    createMagicLink,
    verifyMagicLink,
    ensureAssigned,
    getIntent,
    expireStaleIntents,
    startWatcher,
    stopWatcher,
    migrate,
    $context: context,
  };
};

export type BitcoinPay = ReturnType<typeof createBitcoinPay>;
