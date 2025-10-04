export function formatBTC(sats: number): string {
  return (sats / 100_000_000).toFixed(8);
}

export function parseBTC(btc: string): number {
  return Math.round(Number.parseFloat(btc) * 100_000_000);
}

export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
