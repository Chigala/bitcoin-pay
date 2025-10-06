/**
 * Customer subscriptions API
 *
 * GET /api/subscriptions/customer/:customerId - Get all subscriptions for a customer
 */

import { type NextRequest, NextResponse } from "next/server";
import { getBitcoinPay } from "@/lib/bitcoin-pay";

const bitcoinPay = getBitcoinPay();

interface RouteParams {
  params: {
    customerId: string;
  };
}

/**
 * GET /api/subscriptions/customer/:customerId
 *
 * Query params:
 * - status: string (optional) - Filter by status (active, trialing, past_due, canceled, expired)
 * - planId: string (optional) - Filter by plan ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { searchParams } = new URL(request.url);
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const status = searchParams.get("status") as any;
    const planId = searchParams.get("planId") || undefined;

    const subscriptions = await bitcoinPay.listSubscriptions({
      customerId: params.customerId,
      status,
      planId,
    });

    return NextResponse.json({
      success: true,
      subscriptions,
      count: subscriptions.length,
    });
  } catch (error) {
    console.error("[API] Error listing customer subscriptions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list subscriptions",
      },
      { status: 500 }
    );
  }
}
