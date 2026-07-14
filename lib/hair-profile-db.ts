import type { SupabaseClient } from "@supabase/supabase-js";
import type { HairProfile } from "./mockAnalysis";
import type { Answers } from "./store";

export type DbHairProfileRow = {
  user_id: string;
  answers: Answers;
  profile: HairProfile | null;
  history: HairProfile[];
  created_at: string;
  updated_at: string;
};

export type HairProfileUpsertInput = {
  answers: Answers;
  profile: HairProfile | null;
  history: HairProfile[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHairProfileArray(value: unknown): value is HairProfile[] {
  return Array.isArray(value);
}

function normalizeRow(data: Record<string, unknown>): DbHairProfileRow {
  return {
    user_id: String(data.user_id),
    answers: (isRecord(data.answers) ? data.answers : {}) as Answers,
    profile: (data.profile as HairProfile | null) ?? null,
    history: isHairProfileArray(data.history) ? data.history : [],
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

export async function getHairProfileByUserId(
  admin: SupabaseClient,
  userId: string
): Promise<DbHairProfileRow | null> {
  const { data, error } = await admin
    .from("hair_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[hair-profile-db] getByUserId failed", error);
    return null;
  }

  if (!data) return null;
  return normalizeRow(data as Record<string, unknown>);
}

export async function upsertHairProfile(
  admin: SupabaseClient,
  userId: string,
  input: HairProfileUpsertInput
): Promise<{ error?: string }> {
  const row = {
    user_id: userId,
    answers: input.answers ?? {},
    profile: input.profile,
    history: input.history ?? [],
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("hair_profiles").upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("[hair-profile-db] upsert failed", error);
    return { error: error.message };
  }
  return {};
}

export async function deleteHairProfile(
  admin: SupabaseClient,
  userId: string
): Promise<{ error?: string }> {
  const { error } = await admin.from("hair_profiles").delete().eq("user_id", userId);
  if (error) {
    console.error("[hair-profile-db] delete failed", error);
    return { error: error.message };
  }
  return {};
}
