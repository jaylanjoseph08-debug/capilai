import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe-server";
import { ensureUserSubscriptionSynced } from "@/lib/stripe-subscription-sync";
import { parseJsonBody } from "@/lib/apiErrors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ configured: false, linked: false }, { status: 501 });
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
    if (!isStripeConfigured()) {
      return NextResponse.json({ configured: false, linked: false }, { status: 501 });
    }

    const admin = getSupabaseAdmin();
    const stripe = getStripe();
    const linked = await ensureUserSubscriptionSynced(
      admin,
      stripe,
      authUser.id,
      authUser.email,
      sessionId
    );

    return NextResponse.json({ configured: true, linked });
  } catch (error) {
    console.error("[subscription/link]", error);
    return NextResponse.json({ error: "Failed to link subscription" }, { status: 500 });
  }
}
