import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/lib/stripe-webhook-handlers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const receivedAt = Date.now();
  console.info("\n[stripe webhook] ── incoming request ──────────────────────");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeReady = isStripeConfigured();
  const supabaseReady = isSupabaseAdminConfigured();

  console.info("[stripe webhook] config check", {
    stripeSecretKeySet: stripeReady,
    webhookSecretSet: Boolean(webhookSecret),
    supabaseServiceRoleKeySet: supabaseReady,
    supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
  });

  if (!stripeReady || !webhookSecret) {
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
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.info("[stripe webhook] ✅ signature verified");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error(
      `[stripe webhook] ❌ ABORT — signature verification failed: ${message}\n` +
        "  → Likely cause: STRIPE_WEBHOOK_SECRET in .env.local does not match the `stripe listen` / dashboard endpoint secret."
    );
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
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
      error,
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
