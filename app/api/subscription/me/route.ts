import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  buildSubscriptionMeResponse,
  emptySubscriptionMeResponse,
  type SubscriptionMeResponse,
} from "@/lib/subscription-me-server";
import { getSubscriptionByUserId } from "@/lib/subscription-db";

export const runtime = "nodejs";

export type { SubscriptionMeResponse };

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json<SubscriptionMeResponse>(emptySubscriptionMeResponse(false));
    }

    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const row = await getSubscriptionByUserId(admin, authUser.id);
    return NextResponse.json(await buildSubscriptionMeResponse(row));
  } catch (error) {
    console.error("[subscription/me]", error);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
}
