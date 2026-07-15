import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  getSubscriptionByUserId,
  isActiveSubscriptionStatus,
  type DbSubscription,
} from "@/lib/subscription-db";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import type { Plan, BillingCycle } from "@/lib/plans";

export const runtime = "nodejs";

export type SubscriptionMeResponse = {
  configured: boolean;
  hasActiveSubscription: boolean;
  plan: Plan | null;
  billingCycle: BillingCycle | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canCancel: boolean;
};

function emptyResponse(configured: boolean): SubscriptionMeResponse {
  return {
    configured,
    hasActiveSubscription: false,
    plan: null,
    billingCycle: null,
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canCancel: false,
  };
}

async function enrichFromStripe(
  row: DbSubscription
): Promise<{ currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean }> {
  if (!isStripeConfigured() || !row.stripe_subscription_id) {
    return {
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: false,
    };
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    return {
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError && error.code === "resource_missing") {
      return { currentPeriodEnd: row.current_period_end, cancelAtPeriodEnd: false };
    }
    console.warn("[subscription/me] Stripe retrieve failed", error);
    return { currentPeriodEnd: row.current_period_end, cancelAtPeriodEnd: false };
  }
}

async function toClientResponse(row: DbSubscription | null): Promise<SubscriptionMeResponse> {
  if (!row) {
    return emptyResponse(true);
  }

  const active = isActiveSubscriptionStatus(row.status);
  const stripeMeta = active ? await enrichFromStripe(row) : {
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: false,
  };

  const canCancel =
    active &&
    row.status !== "lifetime" &&
    Boolean(row.stripe_subscription_id) &&
    !stripeMeta.cancelAtPeriodEnd;

  return {
    configured: true,
    hasActiveSubscription: active,
    plan: active ? row.plan : null,
    billingCycle: active ? row.billing_cycle : null,
    status: row.status,
    currentPeriodEnd: stripeMeta.currentPeriodEnd,
    cancelAtPeriodEnd: stripeMeta.cancelAtPeriodEnd,
    canCancel,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json<SubscriptionMeResponse>(emptyResponse(false));
    }

    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const row = await getSubscriptionByUserId(admin, authUser.id);
    return NextResponse.json(await toClientResponse(row));
  } catch (error) {
    console.error("[subscription/me]", error);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
}
