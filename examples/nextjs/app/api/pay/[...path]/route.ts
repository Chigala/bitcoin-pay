import { getBitcoinPay } from "@/lib/bitcoin-pay";

// Get Bitcoin Pay instance
const pay = getBitcoinPay();

// Handle all requests
export async function GET(request: Request) {
	return pay.handler(request);
}

export async function POST(request: Request) {
	return pay.handler(request);
}
