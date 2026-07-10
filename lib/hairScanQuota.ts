import type { Plan } from "./subscriptionStore";
import { STORAGE_KEYS } from "./appConfig";
import { hasPrivateAccess } from "./privateAccess";

/** Monthly hair scan limits per subscription plan. `null` = unlimited. */
export const HAIR_SCAN_LIMITS: Record<Plan, number | null> = {
  free: 2,
  premium: 4,
  pro: null,
};

type QuotaRecord = {
  periodKey: string;
  scansUsed: number;
};

export type HairScanQuotaStatus = {
  allowed: boolean;
  scansUsed: number;
  scansLimit: number | null;
  remaining: number | null;
};

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readQuota(): QuotaRecord {
  const periodKey = currentPeriodKey();
  if (typeof window === "undefined") {
    return { periodKey, scansUsed: 0 };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.hairScanQuota);
    if (!raw) return { periodKey, scansUsed: 0 };
    const parsed = JSON.parse(raw) as QuotaRecord;
    if (parsed.periodKey !== periodKey) {
      return { periodKey, scansUsed: 0 };
    }
    return {
      periodKey,
      scansUsed: typeof parsed.scansUsed === "number" ? parsed.scansUsed : 0,
    };
  } catch {
    return { periodKey, scansUsed: 0 };
  }
}

function writeQuota(record: QuotaRecord): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.hairScanQuota, JSON.stringify(record));
}

export function getHairScanQuotaStatus(plan: Plan | null): HairScanQuotaStatus {
  if (plan === null) {
    return { allowed: false, scansUsed: 0, scansLimit: null, remaining: null };
  }

  const scansLimit = HAIR_SCAN_LIMITS[plan];
  const { scansUsed } = readQuota();

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

export function canStartHairScan(plan: Plan | null): boolean {
  if (hasPrivateAccess()) return true;
  // Allow the initial diagnostic before any plan is selected.
  if (plan === null) return true;
  return getHairScanQuotaStatus(plan).allowed;
}

export function incrementHairScanUsageForPlan(plan: Plan | null): HairScanQuotaStatus {
  if (plan === null) {
    return getHairScanQuotaStatus(null);
  }

  const periodKey = currentPeriodKey();
  const current = readQuota();
  const scansUsed = current.periodKey === periodKey ? current.scansUsed + 1 : 1;
  writeQuota({ periodKey, scansUsed });
  return getHairScanQuotaStatus(plan);
}

/** Next plan to upgrade to when the monthly scan limit is reached. */
export function getUpgradePlan(plan: Plan | null): Plan | null {
  if (plan === null) return null;
  if (plan === "free") return "premium";
  if (plan === "premium") return "pro";
  return null;
}

export function pricingUrlForScanLimit(plan: Plan | null): string {
  if (plan === null) return "/pricing";
  const upgrade = getUpgradePlan(plan);
  if (!upgrade) return "/pricing";
  return `/pricing?from=limit&upgrade=${upgrade}`;
}
