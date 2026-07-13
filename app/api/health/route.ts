import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Lightweight health check — no heavy imports. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
