import type { Plan } from "./subscriptionStore";
import type { SubscriptionMePayload } from "./subscriptionSync";

export function hasServerActiveSubscription(payload: SubscriptionMePayload | null | undefined): boolean {
  return Boolean(payload?.configured && payload.hasActiveSubscription && payload.plan);
}

export function hasPaidAccess(plan: Plan | null): boolean {
  return plan === "free" || plan === "premium" || plan === "pro";
}
