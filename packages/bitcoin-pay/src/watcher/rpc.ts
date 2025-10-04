export interface RPCConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
}

export interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  verificationprogress: number;
}

export interface Transaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: Array<{
    txid?: string;
    vout?: number;
    scriptSig?: { asm: string; hex: string };
    txinwitness?: string[];
    sequence: number;
    coinbase?: string;
  }>;
  vout: Array<{
    value: number;
    n: number;
    scriptPubKey: {
      asm: string;
      desc?: string;
      hex: string;
      address?: string;
      type: string;
    };
  }>;
  hex?: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

export interface UTXO {
  txid: string;
  vout: number;
  address?: string;
  scriptPubKey: string;
  amount: number;
  confirmations: number;
  spendable: boolean;
  solvable: boolean;
  desc?: string;
  safe?: boolean;
}

export class BitcoinRPC {
  private url: string;
  private auth: string;
  private timeout: number;

  constructor(config: RPCConfig) {
    this.url = `http://${config.host}:${config.port}`;
    this.auth = Buffer.from(`${config.username}:${config.password}`).toString(
      "base64"
    );
    this.timeout = config.timeout || 30000;
  }

  private async call<T = unknown>(
    method: string,
    params: unknown[] = []
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.auth}`,
        },
        body: JSON.stringify({
          jsonrpc: "1.0",
          id: Date.now().toString(),
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `RPC HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const json = (await response.json()) as {
        error?: { message: string; code: number };
        result: T;
      };
      if (json.error) {
        throw new Error(
          `RPC error: ${json.error.message} (code: ${json.error.code})`
        );
      }

      return json.result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return await this.call<BlockchainInfo>("getblockchaininfo");
  }

  async getBlockHash(height: number): Promise<string> {
    return await this.call<string>("getblockhash", [height]);
  }

  async getBlock(hash: string, verbosity: 0 | 1 | 2 = 1): Promise<unknown> {
    return await this.call("getblock", [hash, verbosity]);
  }

  async getRawTransaction(
    txid: string,
    verbose = true,
    blockhash?: string
  ): Promise<Transaction | string> {
    const params = blockhash ? [txid, verbose, blockhash] : [txid, verbose];
    return await this.call<Transaction | string>("getrawtransaction", params);
  }

  async decodeRawTransaction(hex: string): Promise<Transaction> {
    return await this.call<Transaction>("decoderawtransaction", [hex]);
  }

  async sendRawTransaction(hex: string, maxFeeRate?: number): Promise<string> {
    const params = maxFeeRate ? [hex, maxFeeRate] : [hex];
    return await this.call<string>("sendrawtransaction", params);
  }

  async testMempoolAccept(rawtxs: string[]): Promise<
    Array<{
      txid: string;
      allowed: boolean;
      rejectReason?: string;
      vsize?: number;
      fees?: { base: number };
    }>
  > {
    return await this.call("testmempoolaccept", [rawtxs]);
  }

  async getTransaction(
    txid: string,
    includeWatchonly = true
  ): Promise<{
    amount: number;
    fee?: number;
    confirmations: number;
    blockhash?: string;
    blockheight?: number;
    blockindex?: number;
    blocktime?: number;
    txid: string;
    time: number;
    timereceived: number;
    details: Array<{
      address?: string;
      category: string;
      amount: number;
      vout: number;
      fee?: number;
    }>;
    hex: string;
  }> {
    return await this.call("gettransaction", [txid, includeWatchonly]);
  }

  async listUnspent(
    minconf = 0,
    maxconf = 9999999,
    addresses?: string[]
  ): Promise<UTXO[]> {
    const params = addresses
      ? [minconf, maxconf, addresses]
      : [minconf, maxconf];
    return await this.call<UTXO[]>("listunspent", params);
  }

  async importDescriptors(
    requests: Array<{
      desc: string;
      active?: boolean;
      range?: number | [number, number];
      next_index?: number;
      timestamp?: number | "now";
      internal?: boolean;
      label?: string;
    }>
  ): Promise<
    Array<{
      success: boolean;
      warnings?: string[];
      error?: { code: number; message: string };
    }>
  > {
    return await this.call("importdescriptors", [requests]);
  }

  async scanTxOutSet(
    action: "start" | "abort" | "status",
    scanobjects: Array<{ desc: string; range?: number | [number, number] }>
  ): Promise<{
    success?: boolean;
    txouts?: number;
    height?: number;
    bestblock?: string;
    unspents?: UTXO[];
    total_amount?: number;
  }> {
    return await this.call("scantxoutset", [action, scanobjects]);
  }

  async estimateSmartFee(
    confTarget: number,
    estimateMode: "ECONOMICAL" | "CONSERVATIVE" = "CONSERVATIVE"
  ): Promise<{
    feerate?: number;
    errors?: string[];
    blocks: number;
  }> {
    return await this.call("estimatesmartfee", [confTarget, estimateMode]);
  }

  async getMemPoolEntry(txid: string): Promise<{
    vsize: number;
    weight: number;
    fee: number;
    modifiedfee: number;
    time: number;
    height: number;
    descendantcount: number;
    descendantsize: number;
    descendantfees: number;
    ancestorcount: number;
    ancestorsize: number;
    ancestorfees: number;
    wtxid: string;
    fees: {
      base: number;
      modified: number;
      ancestor: number;
      descendant: number;
    };
    depends: string[];
    spentby: string[];
    "bip125-replaceable": boolean;
    unbroadcast: boolean;
  }> {
    return await this.call("getmempoolentry", [txid]);
  }

  async getNewAddress(
    label = "",
    addressType?: "legacy" | "p2sh-segwit" | "bech32" | "bech32m"
  ): Promise<string> {
    const params = addressType ? [label, addressType] : [label];
    return await this.call<string>("getnewaddress", params);
  }

  async createWallet(
    name: string,
    options: {
      disablePrivateKeys?: boolean;
      blank?: boolean;
      passphrase?: string;
      avoidReuse?: boolean;
      descriptors?: boolean;
      loadOnStartup?: boolean;
    } = {}
  ): Promise<{ name: string; warning: string }> {
    return await this.call("createwallet", [
      name,
      options.disablePrivateKeys ?? false,
      options.blank ?? false,
      options.passphrase ?? "",
      options.avoidReuse ?? false,
      options.descriptors ?? true,
      options.loadOnStartup ?? true,
    ]);
  }

  async loadWallet(
    filename: string,
    loadOnStartup?: boolean
  ): Promise<{ name: string; warning: string }> {
    const params =
      loadOnStartup !== undefined ? [filename, loadOnStartup] : [filename];
    return await this.call("loadwallet", params);
  }

  async listWallets(): Promise<string[]> {
    return await this.call<string[]>("listwallets");
  }
}
