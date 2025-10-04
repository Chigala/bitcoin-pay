import * as bitcoin from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";

const bip32 = BIP32Factory(ecc);

export interface ParsedDescriptor {
  type: "tr" | "wpkh" | "sh" | "pkh";
  xpub: string;
  derivationPath: string;
  network: bitcoin.Network;
}

export function parseDescriptor(
  descriptor: string,
  network: "mainnet" | "testnet" | "regtest" | "signet" = "mainnet"
): ParsedDescriptor {
  const btcNetwork =
    network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

  const typeMatch = descriptor.match(/^(tr|wpkh|sh|pkh)\(/);
  if (!typeMatch) {
    throw new Error("Unsupported descriptor type");
  }
  const type = typeMatch[1] as "tr" | "wpkh" | "sh" | "pkh";

  const xpubMatch = descriptor.match(/(xpub[a-zA-Z0-9]+|tpub[a-zA-Z0-9]+)/);
  if (!xpubMatch) {
    throw new Error("No xpub found in descriptor");
  }
  const xpub = xpubMatch[1];

  const pathMatch = descriptor.match(/xpub[a-zA-Z0-9]+\/([0-9\/*h']+)/);
  const derivationPath = pathMatch ? pathMatch[1] : "0/*";

  return {
    type,
    xpub,
    derivationPath,
    network: btcNetwork,
  };
}

export function deriveAddress(
  descriptor: ParsedDescriptor,
  index: number
): { address: string; scriptPubKey: Buffer } {
  const node = bip32.fromBase58(descriptor.xpub, descriptor.network);

  const childNode = node.derive(0).derive(index);

  let payment: bitcoin.Payment;
  switch (descriptor.type) {
    case "tr": {
      const internalPubkey = Buffer.from(childNode.publicKey.subarray(1, 33));
      payment = bitcoin.payments.p2tr({
        internalPubkey,
        network: descriptor.network,
      });
      break;
    }
    case "wpkh": {
      payment = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(childNode.publicKey),
        network: descriptor.network,
      });
      break;
    }
    case "sh": {
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(childNode.publicKey),
        network: descriptor.network,
      });
      payment = bitcoin.payments.p2sh({
        redeem: p2wpkh,
        network: descriptor.network,
      });
      break;
    }
    case "pkh": {
      payment = bitcoin.payments.p2pkh({
        pubkey: Buffer.from(childNode.publicKey),
        network: descriptor.network,
      });
      break;
    }
    default:
      throw new Error(`Unsupported descriptor type: ${descriptor.type}`);
  }

  if (!payment.address || !payment.output) {
    throw new Error("Failed to derive address");
  }

  return {
    address: payment.address,
    scriptPubKey: payment.output,
  };
}

export function createBIP21URI(
  address: string,
  amountSats: number,
  label?: string,
  message?: string
): string {
  const amountBTC = (amountSats / 100_000_000).toFixed(8);
  let uri = `bitcoin:${address}?amount=${amountBTC}`;

  if (label) {
    uri += `&label=${encodeURIComponent(label)}`;
  }
  if (message) {
    uri += `&message=${encodeURIComponent(message)}`;
  }

  return uri;
}
