import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  constructStripeEvent,
  getStripeWebhookConfigSnapshot,
  getStripeWebhookSecrets,
  stripeSecretKeyMode,
} from "@/lib/stripe-webhook";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/lib/stripe-webhook-handlers";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Safe config probe — no secrets returned. Useful to verify Vercel env after deploy. */
export async function GET() {
  const snapshot = getStripeWebhookConfigSnapshot();
  const supabaseReady = isSupabaseAdminConfigured();

  let subscriptionsTableOk: boolean | null = null;
  let subscriptionsTableError: string | null = null;

  if (supabaseReady) {
    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("subscriptions").select("user_id").limit(1);
      if (error) {
        subscriptionsTableOk = false;
        subscriptionsTableError = error.message;
      } else {
        subscriptionsTableOk = true;
      }
    } catch (err) {
      subscriptionsTableOk = false;
      subscriptionsTableError = err instanceof Error ? err.message : String(err);
    }
  }

  const ready =
    snapshot.stripeSecretKeySet &&
    snapshot.webhookSecretCount > 0 &&
    snapshot.supabaseServiceRoleKeySet &&
    subscriptionsTableOk === true;

  return NextResponse.json({
    ok: ready,
    ...snapshot,
    subscriptionsTableOk,
    subscriptionsTableError,
    hint: ready
      ? "Webhook config looks ready. Ensure Stripe Dashboard points to /api/webhook (Live mode for live payments)."
      : "Fix missing env vars / create public.subscriptions (run supabase/setup-all.sql), then redeploy.",
  });
}

export async function POST(req: NextRequest) {
  const receivedAt = Date.now();
  console.info("\n[stripe webhook] ── incoming request ──────────────────────");

  const secrets = getStripeWebhookSecrets();
  const stripeReady = isStripeConfigured();
  const supabaseReady = isSupabaseAdminConfigured();
  const keyMode = stripeSecretKeyMode();

  console.info("[stripe webhook] config check", getStripeWebhookConfigSnapshot());

  if (!stripeReady || secrets.length === 0) {
    console.error("[stripe webhook] ❌ ABORT — Stripe not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET missing).");
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 501 });
  }

  if (!supabaseReady) {
    console.error("[stripe webhook] ❌ ABORT — Supabase admin not configured (SUPABASE_SERVICE_ROLE_KEY missing).");
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 501 });
  }

  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  console.info("[stripe webhook] body length:", body.length, "| signature header present:", Boolean(signature));

  if (!signature) {
    console.error("[stripe webhook] ❌ ABORT — Missing stripe-signature header (check Stripe CLI / dashboard endpoint config).");
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const verified = constructStripeEvent(stripe, body, signature);
    event = verified.event;
    console.info("[stripe webhook] ✅ signature verified", { secretIndex: verified.secretIndex });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error(
      `[stripe webhook] ❌ ABORT — signature verification failed: ${message}\n` +
        "  → On Vercel, set STRIPE_WEBHOOK_SECRET to the Dashboard endpoint secret (whsec_…),\n" +
        "    not (only) the Stripe CLI secret from `stripe listen`.\n" +
        "  → You can set both: STRIPE_WEBHOOK_SECRET (Dashboard) + STRIPE_WEBHOOK_SECRET_CLI (local).\n" +
        "  → Live payments need a Live-mode endpoint + Live whsec; Test payments need Test-mode endpoint + Test whsec."
    );
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  if ((event.livemode && keyMode === "test") || (!event.livemode && keyMode === "live")) {
    console.error("[stripe webhook] ❌ ABORT — Stripe mode mismatch", {
      eventLivemode: event.livemode,
      stripeKeyMode: keyMode,
      hint: event.livemode
        ? "Event is LIVE but STRIPE_SECRET_KEY is sk_test_… — set sk_live_… on Vercel Production."
        : "Event is TEST but STRIPE_SECRET_KEY is sk_live_… — use matching modes.",
    });
    return NextResponse.json(
      { error: "Stripe key mode does not match event.livemode" },
      { status: 400 }
    );
  }

  try {
    console.info("[stripe webhook] event received:", {
      id: event.id,
      type: event.type,
      livemode: event.livemode,
    });
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(stripe, admin, event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(stripe, admin, event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(admin, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object as Stripe.Subscription);
        break;
      default:
        console.info("[stripe webhook] ℹ️ unhandled event type (ignored):", event.type);
        break;
    }
    console.info(`[stripe webhook] ✅ event ${event.id} processed in ${Date.now() - receivedAt}ms`);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error("[stripe webhook] Stripe handler error", {
        id: event.id,
        type: event.type,
        stripeType: error.type,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "Webhook Stripe handler failed" }, { status: 502 });
    }

    console.error("[stripe webhook] internal handler error", {
      id: event.id,
      type: event.type,
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    // 500 → Stripe retries; critical so a failed Supabase upsert is not silently dropped.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
