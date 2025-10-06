/**
 * Subscription API endpoints
 *
 * Provides REST API for managing Bitcoin subscriptions
 */

import { type NextRequest, NextResponse } from "next/server";
import { getBitcoinPay } from "@/lib/bitcoin-pay";

const bitcoinPay = getBitcoinPay();

/**
 * GET /api/subscriptions - List all subscription plans
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    const plans = await bitcoinPay.listSubscriptionPlans(activeOnly);

    return NextResponse.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("[API] Error listing subscription plans:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list plans",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscriptions - Create a new subscription
 *
 * Body:
 * {
 *   planId: string,
 *   customerId?: string,
 *   customerEmail?: string,
 *   trialDays?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { planId, customerId, customerEmail, trialDays } = body;

    if (!planId) {
      return NextResponse.json(
        { success: false, error: "planId is required" },
        { status: 400 }
      );
    }

    // Create subscription (includes first payment intent)
    const subscription = await bitcoinPay.createSubscription({
      planId,
      customerId,
      customerEmail,
      trialDays,
    });

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error("[API] Error creating subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create subscription",
      },
      { status: 500 }
    );
  }
}
