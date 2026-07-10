import { NextRequest, NextResponse } from "next/server";
import type { Plan, BillingCycle } from "@/lib/subscriptionStore";
import { apiError, apiNotConfigured } from "@/lib/apiErrors";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";

export const runtime = "nodejs";

const VALID_PLANS: Plan[] = ["free", "premium", "pro"];
const VALID_CYCLES: BillingCycle[] = ["monthly", "annual"];

export async function GET(req: NextRequest) {
  if (!isStripeConfigured()) {
    return apiNotConfigured("STRIPE_SECRET_KEY is not set");
  }

  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return apiError("session_id is required", 400, { code: "MISSING_SESSION_ID" });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status !== "complete") {
      return apiError("Checkout session is not complete", 400, { code: "SESSION_INCOMPLETE" });
    }

    const paid =
      session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (!paid) {
      return apiError("Payment was not completed", 402, { code: "PAYMENT_INCOMPLETE" });
    }

    const plan = session.metadata?.plan as Plan | undefined;
    const billingCycle = session.metadata?.billingCycle as BillingCycle | undefined;

    if (!plan || !VALID_PLANS.includes(plan)) {
      return apiError("Invalid plan in checkout session", 400, { code: "INVALID_PLAN" });
    }
    if (!billingCycle || !VALID_CYCLES.includes(billingCycle)) {
      return apiError("Invalid billing cycle in checkout session", 400, { code: "INVALID_CYCLE" });
    }

    return NextResponse.json({
      configured: true,
      plan,
      billingCycle,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[checkout/session]", error);
    return apiError("Could not verify checkout session", 500, { code: "STRIPE_ERROR" });
  }
}
