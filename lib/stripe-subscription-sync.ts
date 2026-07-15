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

function sessionBelongsToUser(session: Stripe.Checkout.Session, userId: string): boolean {
  const fromMeta = session.metadata?.supabase_user_id?.trim() || session.client_reference_id?.trim();
  return !fromMeta || fromMeta === userId;
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

  if (!plan) {
    console.error("[stripe-subscription-sync] unknown price/plan", priceId);
    return false;
  }

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

/** Write Supabase subscription row from a completed Stripe Checkout session. */
export async function syncSubscriptionFromCheckoutSession(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  sessionId: string
): Promise<boolean> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price", "subscription", "customer"],
  });

  if (!sessionBelongsToUser(session, userId)) {
    console.warn("[stripe-subscription-sync] checkout session user mismatch", sessionId);
    return false;
  }

  if (session.status !== "complete") return false;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return false;
  }

  const plan = resolveCheckoutPlan(session);
  const billingCycle = resolveCheckoutBillingCycle(session);
  if (!plan || !billingCycle) {
    console.error("[stripe-subscription-sync] missing plan metadata", sessionId, session.metadata);
    return false;
  }

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

    // New checkout after a pending cancellation — reactivate billing on the new subscription.
    if (subscription.cancel_at_period_end) {
      await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false });
    }
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

async function refreshExistingActiveSubscription(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string
): Promise<boolean> {
  const existing = await getSubscriptionByUserId(admin, userId);
  if (!existing || !isActiveSubscriptionStatus(existing.status)) {
    return false;
  }

  if (existing.status === "lifetime" && !existing.stripe_subscription_id) {
    return true;
  }

  if (!existing.stripe_subscription_id) {
    return false;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(existing.stripe_subscription_id);
    const status = mapStripeSubscriptionStatus(subscription.status);
    if (!isActiveSubscriptionStatus(status)) {
      await upsertSubscription(admin, {
        userId,
        plan: existing.plan,
        status: "canceled",
        billingCycle: existing.billing_cycle,
        stripeCustomerId: existing.stripe_customer_id,
        stripeSubscriptionId: null,
        stripePriceId: existing.stripe_price_id,
        currentPeriodEnd: null,
      });
      return false;
    }

    return upsertFromStripeSubscription(admin, userId, subscription);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError && error.code === "resource_missing") {
      await upsertSubscription(admin, {
        userId,
        plan: existing.plan,
        status: "canceled",
        billingCycle: existing.billing_cycle,
        stripeCustomerId: existing.stripe_customer_id,
        stripeSubscriptionId: null,
        stripePriceId: existing.stripe_price_id,
        currentPeriodEnd: null,
      });
      return false;
    }
    throw error;
  }
}

/**
 * Fallback when the Stripe webhook did not write Supabase.
 * Looks up paid checkouts / active subscriptions in Stripe by billing email.
 * Always prefers the newest active Stripe subscription over a stale DB row.
 */
export async function syncSubscriptionFromStripeForEmail(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  email: string
): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const customers = await stripe.customers.list({ email: normalizedEmail, limit: 10 });

  let newestActiveSubscription: Stripe.Subscription | null = null;

  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 20,
    });

    for (const subscription of subscriptions.data) {
      if (subscription.status !== "active" && subscription.status !== "trialing") continue;
      if (!newestActiveSubscription || subscription.created > newestActiveSubscription.created) {
        newestActiveSubscription = subscription;
      }
    }
  }

  if (newestActiveSubscription) {
    return upsertFromStripeSubscription(admin, userId, newestActiveSubscription);
  }

  for (const customer of customers.data) {
    const sessions = await stripe.checkout.sessions.list({
      customer: customer.id,
      limit: 20,
    });

    const sortedSessions = [...sessions.data].sort((a, b) => b.created - a.created);
    for (const session of sortedSessions) {
      if (session.status !== "complete") continue;
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        continue;
      }

      const synced = await syncSubscriptionFromCheckoutSession(admin, stripe, userId, session.id);
      if (synced) return true;
    }
  }

  return refreshExistingActiveSubscription(admin, stripe, userId);
}
