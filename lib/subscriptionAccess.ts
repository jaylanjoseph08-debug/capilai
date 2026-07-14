import type { Plan } from "./subscriptionStore";
import type { SubscriptionMePayload } from "./subscriptionSync";
import { hasPrivateAccess } from "./privateAccess";

export function hasServerActiveSubscription(payload: SubscriptionMePayload | null | undefined): boolean {
  return Boolean(payload?.configured && payload.hasActiveSubscription && payload.plan);
}

export function hasPaidAccess(plan: Plan | null): boolean {
  if (hasPrivateAccess()) return true;
  return plan === "free" || plan === "premium" || plan === "pro";
}
