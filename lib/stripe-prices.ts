import type { Plan, BillingCycle } from "./plans";
import { isLifetimePrice } from "./plans";

/**
 * Env var names per plan/cycle (first match wins).
 * Accepts NEXT_PUBLIC_* and server-only STRIPE_PRICE_* aliases.
 */
const PRICE_ENV_KEYS: Record<Plan, Record<BillingCycle, readonly string[]>> = {
  free: {
    monthly: [
      "NEXT_PUBLIC_STRIPE_PRICE_DISCOVERY_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PRICE_FREE_MONTHLY",
      "STRIPE_PRICE_DISCOVERY_MONTHLY",
      "STRIPE_PRICE_FREE_MONTHLY",
    ],
    annual: [
      "NEXT_PUBLIC_STRIPE_PRICE_DISCOVERY_ANNUAL",
      "NEXT_PUBLIC_STRIPE_PRICE_FREE_ANNUAL",
      "STRIPE_PRICE_DISCOVERY_ANNUAL",
      "STRIPE_PRICE_FREE_ANNUAL",
    ],
  },
  premium: {
    monthly: [
      "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIEL_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIAL_MONTHLY",
      "STRIPE_PRICE_ESSENTIEL_MONTHLY",
      "STRIPE_PRICE_ESSENTIAL_MONTHLY",
    ],
    annual: [
      "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIEL_ANNUAL",
      "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIAL_ANNUAL",
      "STRIPE_PRICE_ESSENTIEL_ANNUAL",
      "STRIPE_PRICE_ESSENTIAL_ANNUAL",
    ],
  },
  pro: {
    monthly: [
      "NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY",
      "STRIPE_PRICE_PREMIUM_MONTHLY",
      "STRIPE_PRICE_PRO_MONTHLY",
    ],
    annual: [
      "NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_LIFETIME",
      "NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL",
      "NEXT_PUBLIC_STRIPE_PRICE_PRENIUM_ANNUAL",
      "NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL",
      "STRIPE_PRICE_PREMIUM_LIFETIME",
      "STRIPE_PRICE_PREMIUM_ANNUAL",
      "STRIPE_PRICE_PRO_ANNUAL",
    ],
  },
};

const LIFETIME_PRICE_ENV_KEYS = [
  "NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_LIFETIME",
  "STRIPE_PRICE_PREMIUM_LIFETIME",
] as const;

const SECRET_KEY_CANDIDATES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_API_KEY",
  "STRIPE_SECRET",
] as const;

export const STRIPE_PLANS: Plan[] = ["free", "premium", "pro"];
export const STRIPE_BILLING_CYCLES: BillingCycle[] = ["monthly", "annual"];

function readEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

/** Expand NEXT_PUBLIC_FOO → also try FOO (server-only alias). */
function expandEnvKeys(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    out.push(key);
    if (key.startsWith("NEXT_PUBLIC_")) {
      out.push(key.slice("NEXT_PUBLIC_".length));
    }
  }
  return out;
}

export function getStripeSecretKey(): string | undefined {
  for (const key of SECRET_KEY_CANDIDATES) {
    const value = readEnv(key);
    if (value) return value;
  }
  return undefined;
}

export function getExpectedStripePriceEnvKey(plan: Plan, billingCycle: BillingCycle): string {
  return PRICE_ENV_KEYS[plan][billingCycle][0];
}

export function resolveStripePriceId(plan: Plan, billingCycle: BillingCycle): string | undefined {
  for (const key of expandEnvKeys(PRICE_ENV_KEYS[plan][billingCycle])) {
    const value = readEnv(key);
    if (value) return value;
  }
  return undefined;
}

export function resolvePlanFromStripePrice(priceId: string): Plan | null {
  for (const plan of STRIPE_PLANS) {
    for (const cycle of STRIPE_BILLING_CYCLES) {
      if (resolveStripePriceId(plan, cycle) === priceId) return plan;
    }
  }
  return null;
}

export function isStripePriceConfigured(plan: Plan, billingCycle: BillingCycle): boolean {
  return Boolean(resolveStripePriceId(plan, billingCycle));
}

export function getStripePriceEnvKey(plan: Plan, billingCycle: BillingCycle): string | undefined {
  for (const key of expandEnvKeys(PRICE_ENV_KEYS[plan][billingCycle])) {
    if (readEnv(key)) return key;
  }
  return undefined;
}

export function resolveCheckoutModeForStripePrice(
  priceType: string,
  plan: Plan,
  billingCycle: BillingCycle,
  priceId: string
): "payment" | "subscription" {
  if (priceType === "recurring") return "subscription";
  if (isLifetimeStripeCheckout(plan, billingCycle, priceId)) return "payment";
  return "payment";
}

export function resolveLifetimeStripePriceId(): string | undefined {
  for (const key of LIFETIME_PRICE_ENV_KEYS) {
    const value = readEnv(key);
    if (value) return value;
  }
  return undefined;
}

export function isLifetimeStripePriceId(priceId: string): boolean {
  const lifetimePriceId = resolveLifetimeStripePriceId();
  return Boolean(lifetimePriceId && lifetimePriceId === priceId);
}

export function isLifetimeStripeCheckout(
  plan: Plan,
  billingCycle: BillingCycle,
  priceId: string
): boolean {
  return isLifetimePrice(plan, billingCycle) && isLifetimeStripePriceId(priceId);
}

/** @deprecated Prefer resolveCheckoutModeForStripePrice after retrieving the Price. */
export function resolveStripeCheckoutMode(
  plan: Plan,
  billingCycle: BillingCycle,
  priceId: string
): "payment" | "subscription" {
  return isLifetimeStripeCheckout(plan, billingCycle, priceId) ? "payment" : "subscription";
}

/** Safe diagnostics for ops — never returns secret values. */
export function getStripePriceEnvDiagnostics() {
  const secretKeyName =
    SECRET_KEY_CANDIDATES.find((key) => Boolean(readEnv(key))) ?? null;
  const secretKey = getStripeSecretKey();

  const prices: Record<string, { set: boolean; envKey: string | null }> = {};
  for (const plan of STRIPE_PLANS) {
    for (const cycle of STRIPE_BILLING_CYCLES) {
      const slot = `${plan}.${cycle}`;
      prices[slot] = {
        set: isStripePriceConfigured(plan, cycle),
        envKey: getStripePriceEnvKey(plan, cycle) ?? getExpectedStripePriceEnvKey(plan, cycle),
      };
    }
  }

  return {
    secretKeyPresent: Boolean(secretKey),
    secretKeyEnvName: secretKeyName,
    secretKeyMode: secretKey?.startsWith("sk_live_")
      ? "live"
      : secretKey?.startsWith("sk_test_")
        ? "test"
        : secretKey
          ? "unknown"
          : null,
    publishableKeyPresent: Boolean(
      readEnv("STRIPE_PUBLISHABLE_KEY") || readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
    ),
    webhookSecretPresent: Boolean(readEnv("STRIPE_WEBHOOK_SECRET")),
    prices,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    hint: !secretKey
      ? "STRIPE_SECRET_KEY is missing in this deployment environment. Add it in Vercel → Settings → Environment Variables (Production) and redeploy."
      : Object.values(prices).some((p) => !p.set)
        ? "Some NEXT_PUBLIC_STRIPE_PRICE_* (or STRIPE_PRICE_*) variables are missing. Add Live price IDs and redeploy."
        : "Stripe env looks complete for checkout.",
  };
}
