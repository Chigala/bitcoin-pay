import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  BitcoinPayClientOptions,
  PaymentInitData,
  PaymentStatusData,
} from "../types";
import { BitcoinPayClient } from "../vanilla";

let clientInstance: BitcoinPayClient | null = null;

/**
 * Create or get the Bitcoin Pay client
 */
export function createPaymentClient(
  options?: BitcoinPayClientOptions
): BitcoinPayClient {
  if (!clientInstance) {
    clientInstance = new BitcoinPayClient(options);
  }
  return clientInstance;
}

/**
 * Hook: Initialize payment from magic link token
 */
export function usePaymentInit(token: string, client?: BitcoinPayClient) {
  const payClientRef = useRef<BitcoinPayClient>(
    client ?? (clientInstance || (clientInstance = new BitcoinPayClient()))
  );
  const payClient = payClientRef.current;

  const { data, isPending, error } = useQuery<PaymentInitData, Error>({
    queryKey: ["bitcoin-pay", "init", token],
    enabled: Boolean(token),
    retry: 1,
    queryFn: async () => {
      return await payClient.initPayment(token);
    },
  });

  console.log("this is the data: ", data);

  return {
    data: data ?? null,
    isPending: isPending,
    error: error ?? null,
  };
}

/**
 * Hook: Get and poll payment status
 */
export function usePaymentStatus(
  intentId: string | null | undefined,
  options: { intervalMs?: number; client?: BitcoinPayClient } = {}
) {
  const { intervalMs = 3000, client } = options;
  const payClientRef = useRef<BitcoinPayClient>(
    client ?? (clientInstance || (clientInstance = new BitcoinPayClient()))
  );
  const payClient = payClientRef.current;

  const query = useQuery<PaymentStatusData, Error>({
    queryKey: ["bitcoin-pay", "status", intentId],
    enabled: Boolean(intentId),
    refetchInterval: intervalMs,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      return await payClient.getStatus(intentId as string);
    },
  });

  return {
    status: query.data?.status,
    confs: query.data?.confs || 0,
    txid: query.data?.txid,
    data: query.data ?? null,
    error: query.error ?? null,
  };
}

/**
 * Hook: Generate QR code data URL from BIP21 URI
 */
export function useBip21QR(bip21Uri: string | null | undefined) {
  const [qrData, setQrData] = useState<string | null>(null);

  useEffect(() => {
    if (!bip21Uri) {
      setQrData(null);
      return;
    }

    // Simple QR generation using a data URL placeholder
    // In production, use a proper QR library like qrcode
    const placeholder = `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="10" y="100">QR: ${bip21Uri.substring(
        0,
        20
      )}...</text></svg>`
    )}`;
    setQrData(placeholder);
  }, [bip21Uri]);

  return { qrData };
}

/**
 * Hook: Countdown timer for payment expiry
 */
export function useExpiryCountdown(expiresAt: Date | null | undefined) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }

    const update = () => {
      const now = Date.now();
      const expiry = expiresAt.getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setSecondsLeft(diff);
    };

    update();
    const intervalId = setInterval(update, 1000);

    return () => clearInterval(intervalId);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return { secondsLeft, minutes, seconds };
}
