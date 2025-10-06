/**
 * Individual subscription management API
 *
 * GET /api/subscriptions/:id - Get subscription details
 * DELETE /api/subscriptions/:id - Cancel subscription
 */

import { type NextRequest, NextResponse } from "next/server";
import { getBitcoinPay } from "@/lib/bitcoin-pay";

const bitcoinPay = getBitcoinPay();

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/subscriptions/:id - Get subscription details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const subscription = await bitcoinPay.getSubscription(params.id);

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: "Subscription not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error("[API] Error getting subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get subscription",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subscriptions/:id - Cancel subscription
 *
 * Query params:
 * - immediately: boolean (default: false) - Cancel immediately or at period end
 * - reason: string (optional) - Cancellation reason
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { searchParams } = new URL(request.url);
    const immediately = searchParams.get("immediately") === "true";
    const reason = searchParams.get("reason") || undefined;

    const subscription = await bitcoinPay.cancelSubscription(params.id, {
      immediately,
      reason,
    });

    return NextResponse.json({
      success: true,
      subscription,
      message: immediately
        ? "Subscription canceled immediately"
        : "Subscription will be canceled at the end of the billing period",
    });
  } catch (error) {
    console.error("[API] Error canceling subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel subscription",
      },
      { status: 500 }
    );
  }
}
