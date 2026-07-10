import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  getSubscriptionByUserId,
  isActiveSubscriptionStatus,
  type DbSubscription,
} from "@/lib/subscription-db";
import type { Plan, BillingCycle } from "@/lib/subscriptionStore";

export const runtime = "nodejs";

export type SubscriptionMeResponse = {
  configured: boolean;
  hasActiveSubscription: boolean;
  plan: Plan | null;
  billingCycle: BillingCycle | null;
  status: string | null;
};

function toClientResponse(row: DbSubscription | null): SubscriptionMeResponse {
  if (!row) {
    return {
      configured: true,
      hasActiveSubscription: false,
      plan: null,
      billingCycle: null,
      status: null,
    };
  }

  const active = isActiveSubscriptionStatus(row.status);
  return {
    configured: true,
    hasActiveSubscription: active,
    plan: active ? row.plan : null,
    billingCycle: active ? row.billing_cycle : null,
    status: row.status,
  };
}

export async function GET(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json<SubscriptionMeResponse>({
      configured: false,
      hasActiveSubscription: false,
      plan: null,
      billingCycle: null,
      status: null,
    });
  }

  const authUser = await getAuthUserFromRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const row = await getSubscriptionByUserId(admin, authUser.id);
    return NextResponse.json(toClientResponse(row));
  } catch (error) {
    console.error("[subscription/me]", error);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
}
