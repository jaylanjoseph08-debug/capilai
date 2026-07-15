import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { Plan, BillingCycle } from "@/lib/subscriptionStore";
import { apiError, apiNotConfigured, parseJsonBody } from "@/lib/apiErrors";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import {
  getExpectedStripePriceEnvKey,
  resolveStripePriceId,
  resolveCheckoutModeForStripePrice,
  isLifetimeStripeCheckout,
} from "@/lib/stripe-prices";
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
  if (!authUser) {
    return NextResponse.json(
      { configured: true, error: "Authentication required", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const priceId = resolveStripePriceId(plan, billingCycle);
  if (!priceId) {
    const envKey = getExpectedStripePriceEnvKey(plan, billingCycle);
    return apiError(
      `Aucun Price ID Stripe configuré pour cette offre. Définissez ${envKey} sur Vercel.`,
      400,
      { code: "PRICE_NOT_CONFIGURED" }
    );
  }

  const stripe = getStripe();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;

  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      return apiError("Ce tarif Stripe est inactif.", 400, { code: "PRICE_INACTIVE" });
    }

    const mode = resolveCheckoutModeForStripePrice(price.type, plan, billingCycle, priceId);
    const isLifetime = isLifetimeStripeCheckout(plan, billingCycle, priceId);

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
