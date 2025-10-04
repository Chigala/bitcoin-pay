// NOTE: Do NOT statically import "zeromq" here. We will dynamically import it
// inside start() only if there are active subscriptions. This keeps zeromq
// completely optional for environments (e.g. Next.js dev) where native addons
// cannot be loaded.
import type { TxObservation } from "../types/models.js";

export interface ZMQConfig {
  host: string;
  hashblockPort?: number;
  hashtxPort?: number;
  rawblockPort?: number;
  rawtxPort?: number;
  sequencePort?: number;
}

export interface ZMQEventHandlers {
  onHashBlock?: (hash: Buffer, sequence: number) => void | Promise<void>;
  onHashTx?: (hash: Buffer, sequence: number) => void | Promise<void>;
  onRawBlock?: (block: Buffer, sequence: number) => void | Promise<void>;
  onRawTx?: (tx: Buffer, sequence: number) => void | Promise<void>;
  onSequence?: (data: {
    topic: string;
    hash: Buffer;
    sequence: number;
  }) => void | Promise<void>;
}

export class ZMQWatcher {
  // Use any[] to avoid hard dependency on zeromq types at build time
  private sockets: any[] = [];
  private handlers: ZMQEventHandlers;
  private isRunning = false;

  constructor(private config: ZMQConfig, handlers: ZMQEventHandlers = {}) {
    this.handlers = handlers;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("ZMQ watcher already running");
    }

    const subscriptions: Array<{
      topic: string;
      port: number;
      handler: (data: Buffer) => void | Promise<void>;
    }> = [];

    if (this.config.hashblockPort && this.handlers.onHashBlock) {
      subscriptions.push({
        topic: "hashblock",
        port: this.config.hashblockPort,
        handler: async (data: Buffer) => {
          const hash = data.slice(0, 32);
          const sequence = data.readUInt32LE(32);
          await this.handlers.onHashBlock?.(hash, sequence);
        },
      });
    }

    if (this.config.hashtxPort && this.handlers.onHashTx) {
      subscriptions.push({
        topic: "hashtx",
        port: this.config.hashtxPort,
        handler: async (data: Buffer) => {
          const hash = data.slice(0, 32);
          const sequence = data.readUInt32LE(32);
          await this.handlers.onHashTx?.(hash, sequence);
        },
      });
    }

    if (this.config.rawblockPort && this.handlers.onRawBlock) {
      subscriptions.push({
        topic: "rawblock",
        port: this.config.rawblockPort,
        handler: async (data: Buffer) => {
          const sequence = data.readUInt32LE(data.length - 4);
          const block = data.slice(0, -4);
          await this.handlers.onRawBlock?.(block, sequence);
        },
      });
    }

    if (this.config.rawtxPort && this.handlers.onRawTx) {
      subscriptions.push({
        topic: "rawtx",
        port: this.config.rawtxPort,
        handler: async (data: Buffer) => {
          const sequence = data.readUInt32LE(data.length - 4);
          const tx = data.slice(0, -4);
          await this.handlers.onRawTx?.(tx, sequence);
        },
      });
    }

    if (this.config.sequencePort && this.handlers.onSequence) {
      subscriptions.push({
        topic: "sequence",
        port: this.config.sequencePort,
        handler: async (data: Buffer) => {
          const topic = data.slice(0, 32).toString("utf8").replace(/\0/g, "");
          const hash = data.slice(32, 64);
          const sequence = data.readUInt32LE(64);
          await this.handlers.onSequence?.({ topic, hash, sequence });
        },
      });
    }

    // If no ZMQ ports are configured, skip importing zeromq and return no-op
    if (subscriptions.length === 0) {
      this.isRunning = true;
      return;
    }

    const zmq = await import("zeromq");

    for (const sub of subscriptions) {
      const socket = new (zmq as any).Subscriber();
      const address = `tcp://${this.config.host}:${sub.port}`;

      socket.connect(address);
      socket.subscribe(sub.topic);

      (async () => {
        for await (const [topic, ...msgParts] of socket as any) {
          try {
            const data = msgParts[0] as Buffer;
            await sub.handler(data);
          } catch (err) {
            console.error(`ZMQ handler error for ${sub.topic}:`, err);
          }
        }
      })();

      this.sockets.push(socket);
    }

    this.isRunning = true;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    for (const socket of this.sockets) {
      socket.unsubscribe();
      socket.close();
    }

    this.sockets = [];
    this.isRunning = false;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
