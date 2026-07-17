import Stripe from "stripe";

/** Collect all configured webhook signing secrets (Dashboard + optional CLI / extras). */
export function getStripeWebhookSecrets(): string[] {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_LIVE,
    process.env.STRIPE_WEBHOOK_SECRET_TEST,
    process.env.STRIPE_WEBHOOK_SECRET_CLI,
  ];

  const out: string[] = [];
  for (const raw of secrets) {
    if (!raw?.trim()) continue;
    // Allow comma-separated list in a single env var (useful during secret rotation).
    for (const part of raw.split(",")) {
      const trimmed = part.trim();
      if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    }
  }
  return out;
}

export function stripeSecretKeyMode(): "live" | "test" | "unknown" {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "unknown";
}

/**
 * Verify Stripe signature against every configured secret.
 * Local CLI (`stripe listen`) and Vercel Dashboard endpoints use different whsec values —
 * accepting both prevents the most common local-vs-prod mismatch.
 */
export function constructStripeEvent(
  stripe: Stripe,
  body: string,
  signature: string
): { event: Stripe.Event; secretIndex: number } {
  const secrets = getStripeWebhookSecrets();
  if (secrets.length === 0) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }

  let lastError: unknown;
  for (let i = 0; i < secrets.length; i++) {
    try {
      const event = stripe.webhooks.constructEvent(body, signature, secrets[i]!);
      return { event, secretIndex: i };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Invalid webhook signature");
}

/** Safe (non-secret) config snapshot for ops / Vercel log debugging. */
export function getStripeWebhookConfigSnapshot() {
  const secrets = getStripeWebhookSecrets();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  return {
    stripeSecretKeySet: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    stripeKeyMode: stripeSecretKeyMode(),
    webhookSecretCount: secrets.length,
    webhookSecretPrefixes: secrets.map((s) => `${s.slice(0, 10)}…`),
    supabaseServiceRoleKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    supabaseUrlHost: (() => {
      try {
        return supabaseUrl ? new URL(supabaseUrl).host : null;
      } catch {
        return null;
      }
    })(),
    vercelEnv: process.env.VERCEL_ENV ?? null,
  };
}
