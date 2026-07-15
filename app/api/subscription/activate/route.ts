import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { apiError, apiNotConfigured, parseJsonBody } from "@/lib/apiErrors";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import { getSubscriptionMeForUser } from "@/lib/subscription-me-server";
import { syncSubscriptionFromCheckoutSession } from "@/lib/stripe-subscription-sync";

export const runtime = "nodejs";

/** Force-write subscription from a completed Stripe Checkout session (webhook fallback). */
export async function POST(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return apiNotConfigured("Supabase is not configured");
  }

  if (!isStripeConfigured()) {
    return apiNotConfigured("STRIPE_SECRET_KEY is not set");
  }

  const authUser = await getAuthUserFromRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseJsonBody<{ sessionId: string }>(body, ["sessionId"]);
  const sessionId = parsed?.sessionId?.trim();
  if (!sessionId) {
    return apiError("sessionId is required", 400, { code: "MISSING_SESSION_ID" });
  }

  try {
    const admin = getSupabaseAdmin();
    const stripe = getStripe();
    const synced = await syncSubscriptionFromCheckoutSession(admin, stripe, authUser.id, sessionId);

    if (!synced) {
      return apiError(
        "Could not activate subscription from this checkout session. Try again in a moment.",
        502,
        { code: "ACTIVATION_FAILED" }
      );
    }

    const payload = await getSubscriptionMeForUser(authUser.id);
    if (!payload.hasActiveSubscription) {
      return apiError("Checkout processed but subscription is not active yet.", 502, {
        code: "SUBSCRIPTION_INACTIVE",
      });
    }

    return NextResponse.json({ ...payload, activated: true });
  } catch (error) {
    console.error("[subscription/activate]", error);
    return apiError("Failed to activate subscription", 500, { code: "ACTIVATION_ERROR" });
  }
}
