import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  buildSubscriptionMeResponse,
  emptySubscriptionMeResponse,
  type SubscriptionMeResponse,
} from "@/lib/subscription-me-server";
import { getSubscriptionByUserId, isActiveSubscriptionStatus } from "@/lib/subscription-db";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import { ensureUserSubscriptionSynced } from "@/lib/stripe-subscription-sync";
import { parseJsonBody } from "@/lib/apiErrors";

export const runtime = "nodejs";

export type { SubscriptionMeResponse };

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json<SubscriptionMeResponse>(emptySubscriptionMeResponse(false));
    }

    const authUser = await getAuthUserFromRequest(req);
    if (!authUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    let row = await getSubscriptionByUserId(admin, authUser.id);

    if ((!row || !isActiveSubscriptionStatus(row.status)) && isStripeConfigured()) {
      const stripe = getStripe();
      await ensureUserSubscriptionSynced(admin, stripe, authUser.id, authUser.email);
      row = await getSubscriptionByUserId(admin, authUser.id);
    }

    return NextResponse.json(await buildSubscriptionMeResponse(row));
  } catch (error) {
    console.error("[subscription/me]", error);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
}

/** Force Stripe → Supabase recovery (settings sync button, post-login). */
export async function POST(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json<SubscriptionMeResponse>(emptySubscriptionMeResponse(false));
  }

  const authUser = await getAuthUserFromRequest(req);
  if (!authUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sessionId: string | undefined;
  try {
    const body = await req.json();
    const parsed = parseJsonBody<{ sessionId?: string }>(body, []);
    sessionId = parsed?.sessionId?.trim();
  } catch {
    // optional body
  }

  try {
    const admin = getSupabaseAdmin();
    if (isStripeConfigured()) {
      const stripe = getStripe();
      await ensureUserSubscriptionSynced(admin, stripe, authUser.id, authUser.email, sessionId);
    }

    const row = await getSubscriptionByUserId(admin, authUser.id);
    return NextResponse.json(await buildSubscriptionMeResponse(row));
  } catch (error) {
    console.error("[subscription/me POST]", error);
    return NextResponse.json({ error: "Failed to sync subscription" }, { status: 500 });
  }
}
