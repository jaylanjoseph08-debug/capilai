import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { linkPendingSubscriptionForEmail } from "@/lib/subscription-db";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import { syncSubscriptionFromStripeForEmail } from "@/lib/stripe-subscription-sync";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ configured: false, linked: false }, { status: 501 });
  }

  const authUser = await getAuthUserFromRequest(req);
  if (!authUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    let linked = await linkPendingSubscriptionForEmail(admin, authUser.id, authUser.email);

    if (!linked && isStripeConfigured()) {
      const stripe = getStripe();
      linked = await syncSubscriptionFromStripeForEmail(admin, stripe, authUser.id, authUser.email);
    }

    return NextResponse.json({ configured: true, linked });
  } catch (error) {
    console.error("[subscription/link]", error);
    return NextResponse.json({ error: "Failed to link subscription" }, { status: 500 });
  }
}
