import type { NextRequest } from "next/server";
import { POST as webhookPost } from "@/app/api/webhook/route";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Alias route: accepts Stripe events at /api/webhooks as well. */
export async function POST(req: NextRequest) {
  return webhookPost(req);
}
