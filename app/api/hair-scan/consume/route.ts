import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  getSubscriptionByUserId,
  isActiveSubscriptionStatus,
} from "@/lib/subscription-db";
import { consumeHairScanForUser, currentHairScanPeriodKey } from "@/lib/hair-scan-db";
import { buildHairScanQuotaStatus, type HairScanQuotaStatus } from "@/lib/hairScanLimits";
import type { Plan } from "@/lib/plans";

export const runtime = "nodejs";

export type HairScanConsumeApiResponse = HairScanQuotaStatus & {
  configured: boolean;
  plan: Plan | null;
};

export async function POST(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json<HairScanConsumeApiResponse>({
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

    if (!subscription || !isActiveSubscriptionStatus(subscription.status)) {
      return NextResponse.json(
        { error: "No active subscription", code: "NO_ACTIVE_SUBSCRIPTION" },
        { status: 403 }
      );
    }

    const periodKey = currentHairScanPeriodKey();
    const result = await consumeHairScanForUser(admin, authUser.id, subscription.plan, periodKey);
    const status = buildHairScanQuotaStatus(subscription.plan, result.scans_used);

    if (!result.allowed) {
      return NextResponse.json<HairScanConsumeApiResponse>(
        {
          configured: true,
          plan: subscription.plan,
          ...status,
        },
        { status: 403 }
      );
    }

    return NextResponse.json<HairScanConsumeApiResponse>({
      configured: true,
      plan: subscription.plan,
      ...status,
    });
  } catch (error) {
    console.error("[hair-scan/consume]", error);
    return NextResponse.json({ error: "Failed to consume hair scan quota" }, { status: 500 });
  }
}
