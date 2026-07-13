import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan, BillingCycle } from "./subscriptionStore";
import {
  getSubscriptionByUserId,
  isActiveSubscriptionStatus,
  mapStripeSubscriptionStatus,
  resolveBillingCycleFromStripePrice,
  resolveCheckoutBillingCycle,
  resolveCheckoutPlan,
  resolveLifetimeFromSession,
  resolvePriceIdFromSession,
  upsertSubscription,
  type SubscriptionStatus,
} from "./subscription-db";
import { resolvePlanFromStripePrice } from "./stripe-prices";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function planFromStripePriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return resolvePlanFromStripePrice(priceId);
}

async function upsertFromStripeSubscription(
  admin: SupabaseClient,
  userId: string,
  subscription: Stripe.Subscription
): Promise<boolean> {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const plan =
    planFromStripePriceId(priceId) ??
    (subscription.metadata?.plan === "free" ||
    subscription.metadata?.plan === "premium" ||
    subscription.metadata?.plan === "pro"
      ? subscription.metadata.plan
      : null);

  if (!plan) return false;

  const status = mapStripeSubscriptionStatus(subscription.status);
  if (!isActiveSubscriptionStatus(status)) return false;

  const billingCycle: BillingCycle =
    resolveBillingCycleFromStripePrice(priceId ?? "") ??
    (subscription.metadata?.billingCycle === "monthly" || subscription.metadata?.billingCycle === "annual"
      ? subscription.metadata.billingCycle
      : "monthly");

  const { error } = await upsertSubscription(admin, {
    userId,
    plan,
    status,
    billingCycle,
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  });

  return !error;
}

async function upsertFromCheckoutSession(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  sessionId: string
): Promise<boolean> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price", "subscription", "customer"],
  });

  if (session.status !== "complete") return false;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return false;
  }

  const plan = resolveCheckoutPlan(session);
  const billingCycle = resolveCheckoutBillingCycle(session);
  if (!plan || !billingCycle) return false;

  const priceId = resolvePriceIdFromSession(session);
  const isLifetime = resolveLifetimeFromSession(session, priceId);
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const stripeSubscriptionId = isLifetime
    ? null
    : typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  let status: SubscriptionStatus = isLifetime ? "lifetime" : "active";
  let currentPeriodEnd: Date | null = null;

  if (!isLifetime && stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    status = mapStripeSubscriptionStatus(subscription.status);
    if (!isActiveSubscriptionStatus(status)) return false;
    currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  }

  const { error } = await upsertSubscription(admin, {
    userId,
    plan,
    status,
    billingCycle,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId: priceId,
    currentPeriodEnd: isLifetime ? null : currentPeriodEnd,
  });

  return !error;
}

/**
 * Fallback when the Stripe webhook did not write Supabase (e.g. localhost dev).
 * Looks up paid checkouts / active subscriptions in Stripe by billing email.
 */
export async function syncSubscriptionFromStripeForEmail(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  email: string
): Promise<boolean> {
  const existing = await getSubscriptionByUserId(admin, userId);
  if (existing && isActiveSubscriptionStatus(existing.status)) {
    return true;
  }

  const normalizedEmail = normalizeEmail(email);
  const customers = await stripe.customers.list({ email: normalizedEmail, limit: 10 });

  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });

    for (const subscription of subscriptions.data) {
      const synced = await upsertFromStripeSubscription(admin, userId, subscription);
      if (synced) return true;
    }

    const sessions = await stripe.checkout.sessions.list({
      customer: customer.id,
      limit: 20,
    });

    for (const session of sessions.data) {
      if (session.status !== "complete") continue;
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        continue;
      }

      const synced = await upsertFromCheckoutSession(admin, stripe, userId, session.id);
      if (synced) return true;
    }
  }

  return false;
}
