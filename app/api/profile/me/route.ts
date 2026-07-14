import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  deleteHairProfile,
  getHairProfileByUserId,
  upsertHairProfile,
  type DbHairProfileRow,
} from "@/lib/hair-profile-db";
import type { HairProfile } from "@/lib/mockAnalysis";
import type { Answers } from "@/lib/store";

export const runtime = "nodejs";

export type ProfileMeResponse = {
  configured: boolean;
  answers: Answers;
  profile: HairProfile | null;
  history: HairProfile[];
  updatedAt: string | null;
};

function toClientResponse(row: DbHairProfileRow | null): ProfileMeResponse {
  if (!row) {
    return {
      configured: true,
      answers: {},
      profile: null,
      history: [],
      updatedAt: null,
    };
  }

  return {
    configured: true,
    answers: row.answers ?? {},
    profile: row.profile,
    history: row.history ?? [],
    updatedAt: row.updated_at,
  };
}

function parseSaveBody(body: unknown): { answers: Answers; profile: HairProfile | null; history: HairProfile[] } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const answers = (record.answers && typeof record.answers === "object" ? record.answers : {}) as Answers;
  const profile = (record.profile as HairProfile | null) ?? null;
  const history = Array.isArray(record.history) ? (record.history as HairProfile[]) : [];
  return { answers, profile, history };
}

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json<ProfileMeResponse>({
        configured: false,
        answers: {},
        profile: null,
        history: [],
        updatedAt: null,
      });
    }

    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const row = await getHairProfileByUserId(admin, authUser.id);
    return NextResponse.json(toClientResponse(row));
  } catch (error) {
    console.error("[profile/me GET]", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: "Profile storage is not configured" }, { status: 501 });
    }

    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseSaveBody(body);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid profile payload" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const result = await upsertHairProfile(admin, authUser.id, parsed);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const row = await getHairProfileByUserId(admin, authUser.id);
    return NextResponse.json(toClientResponse(row));
  } catch (error) {
    console.error("[profile/me PUT]", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: "Profile storage is not configured" }, { status: 501 });
    }

    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const result = await deleteHairProfile(admin, authUser.id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[profile/me DELETE]", error);
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
  }
}
