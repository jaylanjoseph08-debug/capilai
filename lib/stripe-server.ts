import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripePublishableKey(): string | undefined {
  return (
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  );
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2024-06-20",
      typescript: true,
    });
  }
  return stripeClient;
}
