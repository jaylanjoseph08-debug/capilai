import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan, BillingCycle } from "./subscriptionStore";
import { isLifetimeStripePriceId, resolveStripePriceId } from "./stripe-prices";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "lifetime"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "inactive";

export type DbSubscription = {
  user_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionUpsertInput = {
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  billingCycle?: BillingCycle | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: Date | null;
};

export type PendingSubscriptionUpsertInput = {
  email: string;
  plan: Plan;
  status: SubscriptionStatus;
  billingCycle?: BillingCycle | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: Date | null;
};

export type DbPendingSubscription = {
  email: string;
  plan: Plan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing", "lifetime"];

export function isActiveSubscriptionStatus(status: SubscriptionStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function mapStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return "inactive";
  }
}

export function isValidPlan(value: string | undefined | null): value is Plan {
  return value === "free" || value === "premium" || value === "pro";
}

export function isValidBillingCycle(value: string | undefined | null): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

export async function upsertSubscription(
  admin: SupabaseClient,
  input: SubscriptionUpsertInput
): Promise<{ error?: string }> {
  const row = {
    user_id: input.userId,
    plan: input.plan,
    status: input.status,
    billing_cycle: input.billingCycle ?? null,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    stripe_price_id: input.stripePriceId ?? null,
    current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("[subscription-db] upsert failed", error);
    return { error: error.message };
  }
  return {};
}

export async function getSubscriptionByUserId(
  admin: SupabaseClient,
  userId: string
): Promise<DbSubscription | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[subscription-db] getByUserId failed", error);
    return null;
  }
  return (data as DbSubscription | null) ?? null;
}

export async function getSubscriptionByStripeSubscriptionId(
  admin: SupabaseClient,
  stripeSubscriptionId: string
): Promise<DbSubscription | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error) {
    console.error("[subscription-db] getByStripeSubscriptionId failed", error);
    return null;
  }
  return (data as DbSubscription | null) ?? null;
}

export async function getSubscriptionByStripeCustomerId(
  admin: SupabaseClient,
  stripeCustomerId: string
): Promise<DbSubscription | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    console.error("[subscription-db] getByStripeCustomerId failed", error);
    return null;
  }
  return (data as DbSubscription | null) ?? null;
}

export async function resolveUserIdFromCheckoutSession(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  const fromMeta = session.metadata?.supabase_user_id?.trim() || session.client_reference_id?.trim();
  if (fromMeta) return fromMeta;

  const email = session.customer_details?.email?.trim() || session.customer_email?.trim();
  if (!email) return null;

  const { data, error } = await admin.rpc("get_user_id_by_email", { p_email: email });
  if (error) {
    console.error("[subscription-db] get_user_id_by_email failed", error);
    return null;
  }
  return typeof data === "string" ? data : null;
}

export function resolveCheckoutPlan(session: Stripe.Checkout.Session): Plan | null {
  if (isValidPlan(session.metadata?.plan)) return session.metadata.plan;
  return null;
}

export function resolveCheckoutBillingCycle(session: Stripe.Checkout.Session): BillingCycle | null {
  if (isValidBillingCycle(session.metadata?.billingCycle)) return session.metadata.billingCycle;
  return null;
}

export function resolvePriceIdFromSession(session: Stripe.Checkout.Session): string | null {
  const lineItem = session.line_items?.data?.[0];
  if (!lineItem?.price) return null;
  const price = lineItem.price;
  return typeof price === "string" ? price : price.id ?? null;
}

export function resolveLifetimeFromSession(
  session: Stripe.Checkout.Session,
  priceId: string | null
): boolean {
  return (
    session.metadata?.purchaseType === "lifetime" ||
    session.mode === "payment" ||
    Boolean(priceId && isLifetimeStripePriceId(priceId))
  );
}

export function stripeCustomerIdFromSession(session: Stripe.Checkout.Session): string | null {
  const customer = session.customer;
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id ?? null;
}

export function stripeSubscriptionIdFromSession(session: Stripe.Checkout.Session): string | null {
  const subscription = session.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id ?? null;
}

/** Infer billing cycle from a configured Stripe price id. */
export function resolveBillingCycleFromStripePrice(priceId: string): BillingCycle | null {
  const plans: Plan[] = ["free", "premium", "pro"];
  const cycles: BillingCycle[] = ["monthly", "annual"];
  for (const plan of plans) {
    for (const cycle of cycles) {
      if (resolveStripePriceId(plan, cycle) === priceId) return cycle;
    }
  }
  if (isLifetimeStripePriceId(priceId)) return "annual";
  return null;
}

export async function upsertPendingSubscription(
  admin: SupabaseClient,
  input: PendingSubscriptionUpsertInput
): Promise<{ error?: string }> {
  const row = {
    email: normalizeEmail(input.email),
    plan: input.plan,
    status: input.status,
    billing_cycle: input.billingCycle ?? null,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    stripe_price_id: input.stripePriceId ?? null,
    current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("pending_subscriptions").upsert(row, { onConflict: "email" });
  if (error) {
    console.error("[subscription-db] upsertPending failed", error);
    return { error: error.message };
  }
  return {};
}

export async function getPendingSubscriptionByEmail(
  admin: SupabaseClient,
  email: string
): Promise<DbPendingSubscription | null> {
  const { data, error } = await admin
    .from("pending_subscriptions")
    .select("*")
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    console.error("[subscription-db] getPendingByEmail failed", error);
    return null;
  }
  return (data as DbPendingSubscription | null) ?? null;
}

/** Attach a guest checkout subscription to a newly created or signed-in user. */
export async function linkPendingSubscriptionForEmail(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<boolean> {
  const pending = await getPendingSubscriptionByEmail(admin, email);
  if (!pending || !isActiveSubscriptionStatus(pending.status)) return false;

  const { error } = await upsertSubscription(admin, {
    userId,
    plan: pending.plan,
    status: pending.status,
    billingCycle: pending.billing_cycle,
    stripeCustomerId: pending.stripe_customer_id,
    stripeSubscriptionId: pending.stripe_subscription_id,
    stripePriceId: pending.stripe_price_id,
    currentPeriodEnd: pending.current_period_end ? new Date(pending.current_period_end) : null,
  });
  if (error) return false;

  await admin.from("pending_subscriptions").delete().eq("email", normalizeEmail(email));
  return true;
}

export function checkoutEmailFromSession(session: Stripe.Checkout.Session): string | null {
  const email = session.customer_details?.email?.trim() || session.customer_email?.trim();
  return email ? normalizeEmail(email) : null;
}
