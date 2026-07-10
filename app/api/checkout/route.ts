import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { Plan, BillingCycle } from "@/lib/subscriptionStore";
import { apiError, apiNotConfigured, parseJsonBody } from "@/lib/apiErrors";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import { resolveStripePriceId, resolveStripeCheckoutMode, isLifetimeStripeCheckout } from "@/lib/stripe-prices";
import type { CheckoutSuccessResponse } from "@/lib/stripe-types";

export const runtime = "nodejs";

const VALID_PLANS: Plan[] = ["free", "premium", "pro"];

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return apiNotConfigured("STRIPE_SECRET_KEY is not set");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = parseJsonBody<{ plan: Plan; billingCycle: BillingCycle }>(body, ["plan", "billingCycle"]);
  if (!parsed) {
    return NextResponse.json({ error: "Le plan et le cycle de facturation sont requis" }, { status: 400 });
  }

  const { plan, billingCycle } = parsed;
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
  }

  const authUser = await getAuthUserFromRequest(req);

  const priceId = resolveStripePriceId(plan, billingCycle);
  if (!priceId) {
    return NextResponse.json(
      { configured: true, error: "Aucun Price ID Stripe configuré pour cette offre." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const mode = resolveStripeCheckoutMode(plan, billingCycle, priceId);
  const isLifetime = isLifetimeStripeCheckout(plan, billingCycle, priceId);

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        plan,
        billingCycle,
        ...(isLifetime ? { purchaseType: "lifetime" } : {}),
      },
      allow_promotion_codes: true,
      success_url: `${origin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    };

    if (authUser) {
      sessionParams.metadata!.supabase_user_id = authUser.id;
      sessionParams.client_reference_id = authUser.id;
    } else if (mode === "payment") {
      sessionParams.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return apiError("Stripe did not return a checkout URL", 502, { code: "NO_URL" });
    }

    const response: CheckoutSuccessResponse = {
      configured: true,
      url: session.url,
      sessionId: session.id,
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Stripe.errors.StripeError ? error.message : "Internal Server Error";
    console.error("[checkout]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
