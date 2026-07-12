import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/adminAuth";
import { fetchAdminLiveData } from "@/lib/adminLive";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authUser = await getAuthUserFromRequest(req);
  if (!authUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminEmail(authUser.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await fetchAdminLiveData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin]", error);
    return NextResponse.json({ error: "Failed to load admin data" }, { status: 500 });
  }
}
