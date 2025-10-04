import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

export interface MagicLinkPayload {
  intentId: string;
  iat: number;
  exp: number;
  nonce: string;
}

export function createMagicLinkToken(
  payload: Omit<MagicLinkPayload, "iat" | "exp">,
  secret: string,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: MagicLinkPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = hmac(sha256, Buffer.from(secret), Buffer.from(payloadB64));
  const signatureB64 = Buffer.from(signature).toString("base64url");

  return `${payloadB64}.${signatureB64}`;
}

export function verifyMagicLinkToken(
  token: string,
  secret: string,
): MagicLinkPayload | null {
  try {
    const [payloadB64, signatureB64] = token.split(".");
    if (!payloadB64 || !signatureB64) {
      return null;
    }

    const expectedSignature = hmac(sha256, Buffer.from(secret), Buffer.from(payloadB64));
    const providedSignature = Buffer.from(signatureB64, "base64url");

    if (!timingSafeEqual(expectedSignature, providedSignature)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as MagicLinkPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
