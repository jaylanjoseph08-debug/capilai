import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe-server";
import { isStripePriceConfigured, STRIPE_BILLING_CYCLES, STRIPE_PLANS } from "@/lib/stripe-prices";
import type { BillingCycle, Plan } from "@/lib/plans";

export const runtime = "nodejs";

export type CheckoutConfigResponse = {
  configured: boolean;
  plans: Record<Plan, Record<BillingCycle, boolean>>;
};

export async function GET() {
  const plans = {} as Record<Plan, Record<BillingCycle, boolean>>;

  for (const plan of STRIPE_PLANS) {
    plans[plan] = { monthly: false, annual: false };
    for (const cycle of STRIPE_BILLING_CYCLES) {
      plans[plan][cycle] = isStripeConfigured() && isStripePriceConfigured(plan, cycle);
    }
  }

  return NextResponse.json<CheckoutConfigResponse>({
    configured: isStripeConfigured(),
    plans,
  });
}
