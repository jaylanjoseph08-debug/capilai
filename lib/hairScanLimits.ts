import type { Plan } from "./plans";

/** Monthly hair scan limits per subscription plan. `null` = unlimited. */
export const HAIR_SCAN_LIMITS: Record<Plan, number | null> = {
  free: 2,
  premium: 4,
  pro: null,
};

export type HairScanQuotaStatus = {
  allowed: boolean;
  scansUsed: number;
  scansLimit: number | null;
  remaining: number | null;
};

export function buildHairScanQuotaStatus(plan: Plan, scansUsed: number): HairScanQuotaStatus {
  const scansLimit = HAIR_SCAN_LIMITS[plan];

  if (scansLimit === null) {
    return { allowed: true, scansUsed, scansLimit: null, remaining: null };
  }

  return {
    allowed: scansUsed < scansLimit,
    scansUsed,
    scansLimit,
    remaining: Math.max(0, scansLimit - scansUsed),
  };
}

export function hairScanLimitForPlan(plan: Plan): number | null {
  return HAIR_SCAN_LIMITS[plan];
}
