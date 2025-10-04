import * as bitcoin from "bitcoinjs-lib";
import ECPairFactory from "ecpair";
import * as ecc from "tiny-secp256k1";

const ECPair = ECPairFactory(ecc);

export interface RefundPSBTInput {
  // UTXO to spend (overpayment)
  txid: string;
  vout: number;
  valueSats: number;
  scriptPubKeyHex: string;
  address: string;

  // Refund details
  refundAddress: string;
  refundAmountSats: number;

  // Fee
  feeRate: number; // sat/vB
  feePayer: "merchant" | "customer";

  // Network
  network: bitcoin.Network;
}

export interface RefundPSBTOutput {
  psbtBase64: string;
  psbtHex: string;
  estimatedFee: number;
  refundAmount: number;
  requiresMerchantSignature: boolean;
}

/**
 * Create a PSBT for refunding an overpayment
 *
 * This creates a partially signed transaction that:
 * 1. Spends the overpayment UTXO
 * 2. Sends refund to customer's address
 * 3. If merchant pays fee: sends change back to merchant
 * 4. If customer pays fee: deducts fee from refund
 *
 * The PSBT must be signed by the merchant's hot wallet
 * (which has the private key for the deposit address)
 */
export function createRefundPSBT(input: RefundPSBTInput): RefundPSBTOutput {
  const psbt = new bitcoin.Psbt({ network: input.network });

  // Add input (the overpayment UTXO)
  psbt.addInput({
    hash: input.txid,
    index: input.vout,
    witnessUtxo: {
      script: Buffer.from(input.scriptPubKeyHex, "hex"),
      value: input.valueSats,
    },
  });

  // Estimate transaction size
  // P2WPKH input: ~68 vB, output: ~31 vB, overhead: ~10 vB
  // Total ~109 vB for 1-in-1-out, ~140 vB for 1-in-2-out
  const numOutputs = input.feePayer === "merchant" ? 2 : 1;
  const estimatedVBytes = 68 + numOutputs * 31 + 10;
  const estimatedFee = Math.ceil(estimatedVBytes * input.feeRate);

  let refundAmount = input.refundAmountSats;
  let changeAmount = input.valueSats - input.refundAmountSats;

  if (input.feePayer === "customer") {
    // Customer pays fee - deduct from refund
    refundAmount -= estimatedFee;
    if (refundAmount < 546) {
      throw new Error(
        `Refund amount after fee (${refundAmount} sats) is below dust threshold`
      );
    }
  } else {
    // Merchant pays fee - deduct from change
    changeAmount -= estimatedFee;
    if (changeAmount < 0) {
      throw new Error(
        `Insufficient funds to cover fee. Need ${estimatedFee} sats but only have ${
          input.valueSats - input.refundAmountSats
        } sats change`
      );
    }
  }

  // Add refund output (to customer)
  psbt.addOutput({
    address: input.refundAddress,
    value: refundAmount,
  });

  // Add change output if merchant pays fee and there's change left
  if (input.feePayer === "merchant" && changeAmount >= 546) {
    // Send change back to original deposit address
    psbt.addOutput({
      address: input.address,
      value: changeAmount,
    });
  }

  const psbtBase64 = psbt.toBase64();
  const psbtHex = psbt.toHex();

  return {
    psbtBase64,
    psbtHex,
    estimatedFee,
    refundAmount,
    requiresMerchantSignature: true,
  };
}

/**
 * Sign and finalize a refund PSBT
 *
 * This should be called by the merchant's signing service
 * with access to the private keys for deposit addresses
 */
export function signRefundPSBT(
  psbtBase64: string,
  privateKey: Buffer,
  network: bitcoin.Network
): { signedPsbtHex: string; txHex: string } {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network });

  const keyPair = ECPair.fromPrivateKey(privateKey, { network });
  const signer = {
    publicKey: Buffer.from(keyPair.publicKey),
    sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
  } as unknown as bitcoin.Signer;

  psbt.signAllInputs(signer);

  // Finalize and extract transaction
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return {
    signedPsbtHex: psbt.toHex(),
    txHex: tx.toHex(),
  };
}

/**
 * Broadcast a signed refund transaction
 */
export async function broadcastRefundTx(
  txHex: string,
  rpcConfig: {
    host: string;
    port: number;
    username: string;
    password: string;
  }
): Promise<string> {
  const { BitcoinRPC } = await import("../watcher/rpc.js");
  const rpc = new BitcoinRPC(rpcConfig);

  const txid = await rpc.sendRawTransaction(txHex);
  return txid;
}

/**
 * Helper to extract refund address from a transaction
 * (useful for detecting where overpayment came from)
 */
export function extractRefundAddressFromTx(
  txHex: string,
  network: bitcoin.Network
): string | null {
  try {
    const tx = bitcoin.Transaction.fromHex(txHex);

    // Look for change output (usually the first input's address)
    if (tx.ins.length === 0) return null;

    // This is a simplification - in practice you'd need to
    // look up the input transaction to get the actual address
    // For now, return null (refund address should be provided by user)
    return null;
  } catch {
    return null;
  }
}
