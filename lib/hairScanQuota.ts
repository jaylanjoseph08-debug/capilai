import type { Plan } from "./subscriptionStore";
import { hasPrivateAccess } from "./privateAccess";
import type { HairScanQuotaStatus } from "./hairScanLimits";

export { HAIR_SCAN_LIMITS, buildHairScanQuotaStatus, type HairScanQuotaStatus } from "./hairScanLimits";

export function canStartHairScanLocally(
  plan: Plan | null,
  status: HairScanQuotaStatus | null,
  options?: { requiresAuth?: boolean }
): boolean {
  if (hasPrivateAccess()) return true;
  if (options?.requiresAuth) return false;
  // Initial diagnostic before any server subscription.
  if (plan === null) return true;
  return status?.allowed ?? false;
}

/** Next plan to upgrade to when the monthly scan limit is reached. */
export function getUpgradePlan(plan: Plan | null): Plan | null {
  if (plan === null) return null;
  if (plan === "free") return "premium";
  if (plan === "premium") return "pro";
  return null;
}

export function pricingUrlForScanLimit(plan: Plan | null): string {
  if (plan === null) return "/pricing?from=diagnostic";
  const upgrade = getUpgradePlan(plan);
  if (!upgrade) return "/pricing?from=limit";
  return `/pricing?from=limit&upgrade=${upgrade}`;
}

export function loginUrlForScan(): string {
  return "/login?next=/scan";
}
