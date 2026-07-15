import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan, BillingCycle } from "./subscriptionStore";
import {
  checkoutEmailFromSession,
  getSubscriptionByUserId,
  isActiveSubscriptionStatus,
  linkPendingSubscriptionForEmail,
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

export type CheckoutSyncResult = { ok: true } | { ok: false; code: string; message?: string };

function sessionBelongsToUser(
  session: Stripe.Checkout.Session,
  userId: string,
  userEmail?: string | null
): boolean {
  const fromMeta = session.metadata?.supabase_user_id?.trim() || session.client_reference_id?.trim();
  if (fromMeta === userId) return true;

  const normalizedUserEmail = userEmail ? normalizeEmail(userEmail) : null;
  const checkoutEmail = checkoutEmailFromSession(session);
  if (normalizedUserEmail && checkoutEmail && normalizedUserEmail === checkoutEmail) {
    return true;
  }

  if (fromMeta && fromMeta !== userId) return false;
  return !fromMeta;
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
  sessionId: string,
  userEmail?: string | null
): Promise<CheckoutSyncResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price", "subscription", "customer"],
  });

  if (!sessionBelongsToUser(session, userId, userEmail)) {
    console.warn("[stripe-subscription-sync] checkout session user mismatch", sessionId);
    return { ok: false, code: "USER_MISMATCH" };
  }

  if (session.status !== "complete") {
    return { ok: false, code: "SESSION_INCOMPLETE" };
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return { ok: false, code: "PAYMENT_INCOMPLETE" };
  }

  const plan = resolveCheckoutPlan(session);
  const billingCycle = resolveCheckoutBillingCycle(session);
  if (!plan || !billingCycle) {
    console.error("[stripe-subscription-sync] missing plan metadata", sessionId, session.metadata);
    return { ok: false, code: "MISSING_PLAN" };
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
    if (!isActiveSubscriptionStatus(status)) {
      return { ok: false, code: "SUBSCRIPTION_INACTIVE", message: subscription.status };
    }
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

  if (error) {
    return { ok: false, code: "UPSERT_FAILED", message: error };
  }

  const checkoutEmail = checkoutEmailFromSession(session);
  if (checkoutEmail) {
    await admin.from("pending_subscriptions").delete().eq("email", normalizeEmail(checkoutEmail));
  }

  if (stripeCustomerId) {
    try {
      await stripe.customers.update(stripeCustomerId, {
        metadata: { supabase_user_id: userId },
      });
    } catch (error) {
      console.warn("[stripe-subscription-sync] customer metadata update failed", error);
    }
  }

  return { ok: true };
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

function escapeStripeSearchValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Paid checkout sessions linked to this Capil AI account (works when Apple Pay uses another email). */
async function findCompletedCheckoutSessionsForUser(
  stripe: Stripe,
  userId: string
): Promise<Stripe.Checkout.Session[]> {
  const escapedUserId = escapeStripeSearchValue(userId);
  const byId = new Map<string, Stripe.Checkout.Session>();

  async function collect(query: string) {
    try {
      const result = await stripe.checkout.sessions.search({ query, limit: 20 });
      for (const session of result.data) {
        byId.set(session.id, session);
      }
    } catch (error) {
      console.warn("[stripe-subscription-sync] checkout session search failed", query, error);
    }
  }

  await collect(`metadata['supabase_user_id']:'${escapedUserId}' AND status:'complete'`);
  await collect(`client_reference_id:'${escapedUserId}' AND status:'complete'`);

  return [...byId.values()].sort((a, b) => b.created - a.created);
}

async function syncSubscriptionsFromStripeCustomersForUser(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string
): Promise<boolean> {
  const escapedUserId = escapeStripeSearchValue(userId);

  try {
    const result = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${escapedUserId}'`,
      limit: 10,
    });

    let newestActiveSubscription: Stripe.Subscription | null = null;

    for (const customer of result.data) {
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
  } catch (error) {
    console.warn("[stripe-subscription-sync] customer search failed", error);
  }

  return false;
}

async function syncFromStripeCustomersByEmail(
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

      const synced = await syncSubscriptionFromCheckoutSession(admin, stripe, userId, session.id, email);
      if (synced.ok) return true;
    }
  }

  return false;
}

async function syncActiveSubscriptionFromCustomer(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  customerId: string
): Promise<boolean> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  let newestActiveSubscription: Stripe.Subscription | null = null;
  for (const subscription of subscriptions.data) {
    if (subscription.status !== "active" && subscription.status !== "trialing") continue;
    if (!newestActiveSubscription || subscription.created > newestActiveSubscription.created) {
      newestActiveSubscription = subscription;
    }
  }

  if (!newestActiveSubscription) return false;

  try {
    await stripe.customers.update(customerId, {
      metadata: { supabase_user_id: userId },
    });
  } catch (error) {
    console.warn("[stripe-subscription-sync] customer metadata update failed", error);
  }

  return upsertFromStripeSubscription(admin, userId, newestActiveSubscription);
}

/** Link pending rows saved under Apple Pay / billing emails from this user's checkouts. */
export async function linkPendingFromUserCheckoutSessions(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  authEmail: string
): Promise<boolean> {
  if (await linkPendingSubscriptionForEmail(admin, userId, authEmail)) return true;

  const checkoutSessions = await findCompletedCheckoutSessionsForUser(stripe, userId);
  for (const session of checkoutSessions) {
    const billingEmail = checkoutEmailFromSession(session);
    if (billingEmail && (await linkPendingSubscriptionForEmail(admin, userId, billingEmail))) {
      return true;
    }
  }

  return false;
}

/**
 * Fallback when the Stripe webhook did not write Supabase.
 * Finds subscriptions by Capil AI user id first (Apple Pay / different billing email),
 * then by account email.
 */
export async function syncSubscriptionFromStripeForUser(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  email: string
): Promise<boolean> {
  const checkoutSessions = await findCompletedCheckoutSessionsForUser(stripe, userId);
  for (const session of checkoutSessions) {
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      continue;
    }
    const synced = await syncSubscriptionFromCheckoutSession(admin, stripe, userId, session.id, email);
    if (synced.ok) return true;
  }

  for (const session of checkoutSessions) {
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    if (customerId && (await syncActiveSubscriptionFromCustomer(admin, stripe, userId, customerId))) {
      return true;
    }
  }

  if (await syncSubscriptionsFromStripeCustomersForUser(admin, stripe, userId)) {
    return true;
  }

  if (await syncFromStripeCustomersByEmail(admin, stripe, userId, email)) {
    return true;
  }

  return refreshExistingActiveSubscription(admin, stripe, userId);
}

/** @deprecated Prefer syncSubscriptionFromStripeForUser */
export async function syncSubscriptionFromStripeForEmail(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  email: string
): Promise<boolean> {
  return syncSubscriptionFromStripeForUser(admin, stripe, userId, email);
}
