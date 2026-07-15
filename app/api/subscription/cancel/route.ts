import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  getSubscriptionByUserId,
  isActiveSubscriptionStatus,
  mapStripeSubscriptionStatus,
  upsertSubscription,
} from "@/lib/subscription-db";
import { apiError, apiNotConfigured } from "@/lib/apiErrors";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";

export const runtime = "nodejs";

export type SubscriptionCancelResponse = {
  configured: boolean;
  ok: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  error?: string;
  code?: string;
};

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

  try {
    const admin = getSupabaseAdmin();
    const row = await getSubscriptionByUserId(admin, authUser.id);

    if (!row || !isActiveSubscriptionStatus(row.status)) {
      return apiError("No active subscription to cancel", 404, { code: "NO_ACTIVE_SUBSCRIPTION" });
    }

    if (row.status === "lifetime") {
      return apiError("Lifetime access cannot be cancelled online. Contact support.", 400, {
        code: "LIFETIME_NOT_CANCELLABLE",
      });
    }

    if (!row.stripe_subscription_id) {
      return apiError("This subscription is not linked to Stripe billing.", 400, {
        code: "NO_STRIPE_SUBSCRIPTION",
      });
    }

    const stripe = getStripe();
    let subscription: Stripe.Subscription;

    try {
      subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === "resource_missing") {
        await upsertSubscription(admin, {
          userId: authUser.id,
          plan: row.plan,
          status: "canceled",
          billingCycle: row.billing_cycle,
          stripeCustomerId: row.stripe_customer_id,
          stripeSubscriptionId: null,
          stripePriceId: row.stripe_price_id,
          currentPeriodEnd: null,
        });
        return apiError("Subscription was already cancelled.", 400, { code: "ALREADY_CANCELLED" });
      }
      throw error;
    }

    if (subscription.status === "canceled") {
      await upsertSubscription(admin, {
        userId: authUser.id,
        plan: row.plan,
        status: "canceled",
        billingCycle: row.billing_cycle,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: null,
        stripePriceId: row.stripe_price_id,
        currentPeriodEnd: null,
      });
      return apiError("Subscription was already cancelled.", 400, { code: "ALREADY_CANCELLED" });
    }

    if (!subscription.cancel_at_period_end) {
      subscription = await stripe.subscriptions.update(row.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await upsertSubscription(admin, {
      userId: authUser.id,
      plan: row.plan,
      status: mapStripeSubscriptionStatus(subscription.status),
      billingCycle: row.billing_cycle,
      stripeCustomerId:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
      stripeSubscriptionId: subscription.id,
      stripePriceId: row.stripe_price_id,
      currentPeriodEnd,
    });

    const response: SubscriptionCancelResponse = {
      configured: true,
      ok: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Stripe.errors.StripeError ? error.message : "Failed to cancel subscription";
    console.error("[subscription/cancel]", error);
    return apiError(message, 500, { code: "STRIPE_ERROR" });
  }
}
