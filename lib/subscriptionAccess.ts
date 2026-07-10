import type { Plan } from "./subscriptionStore";
import { hasPrivateAccess } from "./privateAccess";

export function hasPaidAccess(plan: Plan | null): boolean {
  if (hasPrivateAccess()) return true;
  return plan === "free" || plan === "premium" || plan === "pro";
}
