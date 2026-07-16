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
  resolveSubscriptionPeriodEnd,
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
  const tag = "[stripe webhook][checkout.session.completed]";
  console.info(`${tag} ▶ start — session id: ${sessionInput.id}`);

  const session = await stripe.checkout.sessions.retrieve(sessionInput.id, {
    expand: ["line_items.data.price", "subscription", "customer"],
  });
  console.info(`${tag} session retrieved from Stripe:`, {
    id: session.id,
    payment_status: session.payment_status,
    status: session.status,
    mode: session.mode,
    metadata: session.metadata,
    client_reference_id: session.client_reference_id,
    customer: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    subscription:
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
    customer_email: session.customer_details?.email ?? session.customer_email ?? null,
  });

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.warn(
      `${tag} ⏸ STOP — payment_status is "${session.payment_status}" (expected "paid" or "no_payment_required"). Nothing written to Supabase.`
    );
    return;
  }

  const plan = resolveCheckoutPlan(session);
  const billingCycle = resolveCheckoutBillingCycle(session);
  console.info(`${tag} resolved plan/billingCycle from session:`, { plan, billingCycle });
  if (!plan || !billingCycle) {
    console.error(
      `${tag} ❌ STOP — could not resolve plan or billingCycle.\n` +
        "  → Check that checkout session metadata.plan / metadata.billingCycle were set at creation,\n" +
        "  → or that the line item price id matches one of your NEXT_PUBLIC_STRIPE_PRICE_* env vars.",
      { sessionId: session.id, metadata: session.metadata }
    );
    return;
  }

  const userId = await resolveUserIdFromCheckoutSession(admin, session);
  console.info(`${tag} resolved Supabase user id:`, userId ?? "(none — will try email fallback)");

  const priceId = resolvePriceIdFromSession(session);
  const isLifetime = resolveLifetimeFromSession(session, priceId);
  const stripeCustomerId = stripeCustomerIdFromSession(session);
  const stripeSubscriptionId = isLifetime ? null : stripeSubscriptionIdFromSession(session);
  console.info(`${tag} derived Stripe ids:`, { priceId, isLifetime, stripeCustomerId, stripeSubscriptionId });

  let status: SubscriptionStatus = isLifetime ? "lifetime" : "active";
  let currentPeriodEnd: Date | null = null;

  if (!isLifetime && stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    status = mapStripeSubscriptionStatus(subscription.status);
    currentPeriodEnd = resolveSubscriptionPeriodEnd(subscription);
    console.info(`${tag} subscription details from Stripe:`, {
      stripeStatus: subscription.status,
      mappedStatus: status,
      currentPeriodEnd,
    });
  }

  if (!userId) {
    const email = checkoutEmailFromSession(session);
    if (!email) {
      console.error(
        `${tag} ❌ STOP — no supabase_user_id / client_reference_id AND no customer email on the session.\n` +
          "  → This means the Checkout Session was created without linking the logged-in user (see app/api/checkout/route.ts)."
      );
      return;
    }

    console.warn(
      `${tag} ⚠ no userId resolved — writing to pending_subscriptions for email "${email}" instead of subscriptions.\n` +
        "  → This row will only attach to a real user on next login/signup with this email (see linkPendingSubscriptionForEmail)."
    );

    const { error } = await upsertPendingSubscription(admin, {
      email,
      plan,
      status,
      billingCycle,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId,
      currentPeriodEnd: isLifetime ? null : currentPeriodEnd,
    });

    if (error) {
      console.error(`${tag} ❌ Supabase upsertPendingSubscription FAILED:`, error);
    } else {
      console.info(`${tag} ✅ pending_subscriptions row written for "${email}"`);
    }
    return;
  }

  console.info(`${tag} writing to public.subscriptions via service role client...`, {
    userId,
    plan,
    status,
    billingCycle,
    stripeCustomerId,
    stripeSubscriptionId,
  });

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
    console.error(
      `${tag} ❌ Supabase upsertSubscription FAILED — this is very likely why the app keeps redirecting to /pricing:`,
      error
    );
  } else {
    console.info(`${tag} ✅ SUCCESS — subscriptions row upserted for user ${userId} (plan: ${plan}, status: ${status})`);
  }
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
    currentPeriodEnd: resolveSubscriptionPeriodEnd(subscription),
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
    currentPeriodEnd: resolveSubscriptionPeriodEnd(subscription),
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
