import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingCycle, Plan } from "./subscriptionStore";
import {
  getSubscriptionByStripeCustomerId,
  getSubscriptionByStripeSubscriptionId,
  mapStripeSubscriptionStatus,
  resolveBillingCycleFromStripePrice,
  resolveCheckoutBillingCycle,
  resolveCheckoutPlan,
  resolveLifetimeFromSession,
  resolvePriceIdFromSession,
  resolveUserIdFromCheckoutSession,
  stripeCustomerIdFromSession,
  stripeSubscriptionIdFromSession,
  upsertSubscription,
  upsertPendingSubscription,
  checkoutEmailFromSession,
  type SubscriptionStatus,
} from "./subscription-db";

export async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  admin: SupabaseClient,
  sessionInput: Stripe.Checkout.Session
): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(sessionInput.id, {
    expand: ["line_items.data.price", "subscription", "customer"],
  });

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.warn("[stripe webhook] checkout.session.completed — payment not completed", session.id);
    return;
  }

  const plan = resolveCheckoutPlan(session);
  const billingCycle = resolveCheckoutBillingCycle(session);
  if (!plan || !billingCycle) {
    console.error("[stripe webhook] checkout.session.completed — missing plan metadata", session.id);
    return;
  }

  const userId = await resolveUserIdFromCheckoutSession(admin, session);
  const priceId = resolvePriceIdFromSession(session);
  const isLifetime = resolveLifetimeFromSession(session, priceId);
  const stripeCustomerId = stripeCustomerIdFromSession(session);
  const stripeSubscriptionId = isLifetime ? null : stripeSubscriptionIdFromSession(session);

  let status: SubscriptionStatus = isLifetime ? "lifetime" : "active";
  let currentPeriodEnd: Date | null = null;

  if (!isLifetime && stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    status = mapStripeSubscriptionStatus(subscription.status);
    currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  }

  if (!userId) {
    const email = checkoutEmailFromSession(session);
    if (!email) {
      console.error("[stripe webhook] checkout.session.completed — no user or email", session.id);
      return;
    }

    await upsertPendingSubscription(admin, {
      email,
      plan,
      status,
      billingCycle,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId,
      currentPeriodEnd: isLifetime ? null : currentPeriodEnd,
    });
    return;
  }

  await upsertSubscription(admin, {
    userId,
    plan,
    status,
    billingCycle,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId: priceId,
    currentPeriodEnd: isLifetime ? null : currentPeriodEnd,
  });
}

export async function handleInvoicePaymentSucceeded(
  stripe: Stripe,
  admin: SupabaseClient,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  if (!subscriptionId) return;

  const existing = await getSubscriptionByStripeSubscriptionId(admin, subscriptionId);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id ?? existing?.stripe_price_id ?? null;
  const plan = existing?.plan ?? planFromInvoiceMetadata(invoice);
  const billingCycle =
    existing?.billing_cycle ??
    (priceId ? resolveBillingCycleFromStripePrice(priceId) : null) ??
    "monthly";

  if (!plan) {
    console.error("[stripe webhook] invoice.payment_succeeded — unknown plan", invoice.id);
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;
  if (!customerId) {
    console.error("[stripe webhook] invoice.payment_succeeded — no customer", invoice.id);
    return;
  }

  const userId = existing?.user_id ?? (await resolveUserIdFromCustomer(admin, stripe, customerId));
  if (!userId) {
    console.error("[stripe webhook] invoice.payment_succeeded — no user", invoice.id);
    return;
  }

  await upsertSubscription(admin, {
    userId,
    plan,
    status: mapStripeSubscriptionStatus(subscription.status),
    billingCycle,
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  });
}

export async function handleSubscriptionUpdated(
  admin: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const subscriptionId = subscription.id;
  const existing = await getSubscriptionByStripeSubscriptionId(admin, subscriptionId);
  if (!existing) {
    console.warn("[stripe webhook] subscription.updated — unknown subscription", subscriptionId);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? existing.stripe_price_id;
  const status = mapStripeSubscriptionStatus(subscription.status);

  await upsertSubscription(admin, {
    userId: existing.user_id,
    plan: existing.plan,
    status,
    billingCycle: existing.billing_cycle,
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  });
}

export async function handleSubscriptionDeleted(
  admin: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const existing = await getSubscriptionByStripeSubscriptionId(admin, subscription.id);
  if (!existing) return;

  await upsertSubscription(admin, {
    userId: existing.user_id,
    plan: existing.plan,
    status: "canceled",
    billingCycle: existing.billing_cycle,
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    stripeSubscriptionId: null,
    stripePriceId: existing.stripe_price_id,
    currentPeriodEnd: null,
  });
}

function planFromInvoiceMetadata(invoice: Stripe.Invoice): Plan | null {
  const plan = invoice.metadata?.plan;
  if (plan === "free" || plan === "premium" || plan === "pro") return plan;
  return null;
}

async function resolveUserIdFromCustomer(
  admin: SupabaseClient,
  stripe: Stripe,
  customerId: string
): Promise<string> {
  const existing = await getSubscriptionByStripeCustomerId(admin, customerId);
  if (existing) return existing.user_id;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return "";

  const email = "email" in customer ? customer.email : null;
  if (!email) return "";

  const { data } = await admin.rpc("get_user_id_by_email", { p_email: email });
  return typeof data === "string" ? data : "";
}
