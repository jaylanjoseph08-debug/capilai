import type { Plan, BillingCycle } from "./subscriptionStore";
import { isLifetimePrice } from "./pricing";

/** Env var names per plan/cycle. First match wins. */
const PRICE_ENV_KEYS: Record<Plan, Record<BillingCycle, readonly string[]>> = {
  free: {
    monthly: [
      "NEXT_PUBLIC_STRIPE_PRICE_DISCOVERY_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PRICE_FREE_MONTHLY",
    ],
    annual: [
      "NEXT_PUBLIC_STRIPE_PRICE_DISCOVERY_ANNUAL",
      "NEXT_PUBLIC_STRIPE_PRICE_FREE_ANNUAL",
    ],
  },
  premium: {
    monthly: [
      "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIEL_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIAL_MONTHLY",
    ],
    annual: [
      "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIEL_ANNUAL",
      "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIAL_ANNUAL",
    ],
  },
  pro: {
    monthly: [
      "NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY",
    ],
    annual: [
      "NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_LIFETIME",
      "NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL",
      "NEXT_PUBLIC_STRIPE_PRICE_PRENIUM_ANNUAL",
      "NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL",
    ],
  },
};

const LIFETIME_PRICE_ENV_KEYS = ["NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_LIFETIME"] as const;

export function resolveStripePriceId(plan: Plan, billingCycle: BillingCycle): string | undefined {
  for (const key of PRICE_ENV_KEYS[plan][billingCycle]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getStripePriceEnvKey(plan: Plan, billingCycle: BillingCycle): string | undefined {
  for (const key of PRICE_ENV_KEYS[plan][billingCycle]) {
    if (process.env[key]?.trim()) return key;
  }
  return undefined;
}

export function resolveLifetimeStripePriceId(): string | undefined {
  for (const key of LIFETIME_PRICE_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function isLifetimeStripePriceId(priceId: string): boolean {
  const lifetimePriceId = resolveLifetimeStripePriceId();
  return Boolean(lifetimePriceId && lifetimePriceId === priceId);
}

/** Premium à vie (pro + annual) with a one-time Stripe price → Checkout `payment` mode. */
export function isLifetimeStripeCheckout(
  plan: Plan,
  billingCycle: BillingCycle,
  priceId: string
): boolean {
  return isLifetimePrice(plan, billingCycle) && isLifetimeStripePriceId(priceId);
}

export function resolveStripeCheckoutMode(
  plan: Plan,
  billingCycle: BillingCycle,
  priceId: string
): "payment" | "subscription" {
  return isLifetimeStripeCheckout(plan, billingCycle, priceId) ? "payment" : "subscription";
}
