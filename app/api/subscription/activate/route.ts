import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { apiError, apiNotConfigured, parseJsonBody } from "@/lib/apiErrors";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import { getSubscriptionMeForUser } from "@/lib/subscription-me-server";
import { syncSubscriptionFromCheckoutSession } from "@/lib/stripe-subscription-sync";

export const runtime = "nodejs";

const ACTIVATION_MESSAGES: Record<string, string> = {
  USER_MISMATCH:
    "This payment belongs to another account. Sign in with the same email you used on Stripe.",
  SESSION_INCOMPLETE: "Checkout session is not complete yet.",
  PAYMENT_INCOMPLETE: "Payment was not completed for this session.",
  MISSING_PLAN: "Could not determine the plan for this checkout.",
  SUBSCRIPTION_INACTIVE: "Stripe subscription is not active yet.",
  UPSERT_FAILED: "Could not save subscription to the database.",
};

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
    return apiError("Sign in to activate your subscription.", 401, { code: "AUTH_REQUIRED" });
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
    const synced = await syncSubscriptionFromCheckoutSession(
      admin,
      stripe,
      authUser.id,
      sessionId,
      authUser.email
    );

    if (!synced.ok) {
      const message = ACTIVATION_MESSAGES[synced.code] ?? "Could not activate subscription from this checkout session.";
      console.error("[subscription/activate]", synced.code, synced.message ?? "", sessionId);
      return apiError(message, 502, { code: synced.code });
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
