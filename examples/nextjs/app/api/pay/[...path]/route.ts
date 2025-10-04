import { getBitcoinPay } from "@/lib/bitcoin-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pay = getBitcoinPay();

export async function GET(request: Request) {
  return pay.handler(request);
}

export async function POST(request: Request) {
  return pay.handler(request);
}
