import type { LiteralString } from "./helper";
import type { StorageAdapter } from "./adapter";

export type PluginSchema = {
  [table: string]: {
    fields: {
      [field: string]: {
        type: "string" | "number" | "boolean" | "date" | "json";
        required?: boolean;
        defaultValue?: unknown;
        unique?: boolean;
      };
    };
    disableMigration?: boolean;
    modelName?: string;
  };
};

export interface PluginContext {
  storage: StorageAdapter;
  [key: string]: unknown;
}

export interface PluginEventData {
  intentId: string;
  txid?: string;
  valueSats?: number;
  confirmations?: number;
  [key: string]: unknown;
}

export interface BitcoinPayPlugin {
  id: LiteralString;
  schema?: PluginSchema;
  init?: (context: PluginContext) => void | Promise<void>;
  endpoints?: Record<string, (req: unknown, context: PluginContext) => Promise<unknown>>;
  hooks?: {
    onIntentCreated?: (data: PluginEventData, context: PluginContext) => Promise<void> | void;
    onProcessing?: (data: PluginEventData, context: PluginContext) => Promise<void> | void;
    onConfirmed?: (data: PluginEventData, context: PluginContext) => Promise<void> | void;
    onExpired?: (data: PluginEventData, context: PluginContext) => Promise<void> | void;
  };
}
