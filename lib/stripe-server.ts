import Stripe from "stripe";
import { getStripeSecretKey } from "./stripe-prices";

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey());
}

export function getStripePublishableKey(): string | undefined {
  return (
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  );
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = getStripeSecretKey();
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    try {
      // Pin to the API version bundled with the installed SDK. Forcing a newer version
      // (e.g. "2026-05-27.dahlia") changes response shapes — notably `current_period_end`
      // moved off the Subscription object — and breaks the SDK's TypeScript types.
      stripeClient = new Stripe(secretKey, {
        apiVersion: "2024-06-20",
        typescript: true,
      });
    } catch (error) {
      stripeClient = null;
      throw error;
    }
  }
  return stripeClient;
}
