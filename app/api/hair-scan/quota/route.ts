import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  getSubscriptionByUserId,
  isActiveSubscriptionStatus,
} from "@/lib/subscription-db";
import {
  currentHairScanPeriodKey,
  getHairScanUsageForUser,
} from "@/lib/hair-scan-db";
import { buildHairScanQuotaStatus, type HairScanQuotaStatus } from "@/lib/hairScanLimits";
import type { Plan } from "@/lib/plans";

export const runtime = "nodejs";

export type HairScanQuotaApiResponse = HairScanQuotaStatus & {
  configured: boolean;
  plan: Plan | null;
};

function quotaResponse(
  plan: Plan | null,
  scansUsed: number,
  configured = true
): NextResponse<HairScanQuotaApiResponse> {
  const status = plan ? buildHairScanQuotaStatus(plan, scansUsed) : {
    allowed: false,
    scansUsed,
    scansLimit: null,
    remaining: null,
  };

  return NextResponse.json({
    configured,
    plan,
    ...status,
  });
}

export async function GET(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json<HairScanQuotaApiResponse>({
      configured: false,
      allowed: false,
      scansUsed: 0,
      scansLimit: null,
      remaining: null,
      plan: null,
    });
  }

  const authUser = await getAuthUserFromRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const subscription = await getSubscriptionByUserId(admin, authUser.id);
    const periodKey = currentHairScanPeriodKey();
    const scansUsed = await getHairScanUsageForUser(admin, authUser.id, periodKey);

    if (!subscription || !isActiveSubscriptionStatus(subscription.status)) {
      return quotaResponse(null, scansUsed);
    }

    return quotaResponse(subscription.plan, scansUsed);
  } catch (error) {
    console.error("[hair-scan/quota]", error);
    return NextResponse.json({ error: "Failed to load hair scan quota" }, { status: 500 });
  }
}
