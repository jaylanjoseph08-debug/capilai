/** Server-safe plan types (no client store dependency). */
export type Plan = "free" | "premium" | "pro";
export type BillingCycle = "monthly" | "annual";

export function isLifetimePrice(plan: Plan, cycle: BillingCycle): boolean {
  return plan === "pro" && cycle === "annual";
}
