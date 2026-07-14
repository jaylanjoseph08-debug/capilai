"use client";

import type { HairProfile } from "./mockAnalysis";
import type { Answers } from "./store";

export type ProfileMePayload = {
  configured: boolean;
  answers: Answers;
  profile: HairProfile | null;
  history: HairProfile[];
  updatedAt: string | null;
};

export type ProfileSaveInput = {
  answers: Answers;
  profile: HairProfile | null;
  history: HairProfile[];
};

async function authHeaders(): Promise<HeadersInit | null> {
  const { getAccessToken } = await import("./supabase/session");
  const token = await getAccessToken();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchProfileFromServer(): Promise<ProfileMePayload | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  try {
    const res = await fetch("/api/profile/me", { headers, cache: "no-store" });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return (await res.json()) as ProfileMePayload;
  } catch {
    return null;
  }
}

export async function saveProfileToServer(input: ProfileSaveInput): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;

  try {
    const res = await fetch("/api/profile/me", {
      method: "PUT",
      headers,
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteProfileOnServer(): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;

  try {
    const res = await fetch("/api/profile/me", { method: "DELETE", headers });
    return res.ok;
  } catch {
    return false;
  }
}

export function profileGeneratedAtMs(profile: HairProfile | null | undefined): number {
  if (!profile?.generatedAt) return 0;
  const ms = new Date(profile.generatedAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Merge histories by generatedAt (newest first), deduped. */
export function mergeProfileHistory(local: HairProfile[], remote: HairProfile[]): HairProfile[] {
  const byKey = new Map<string, HairProfile>();
  for (const item of [...local, ...remote]) {
    const key = item.generatedAt || JSON.stringify(item.score);
    const existing = byKey.get(key);
    if (!existing || profileGeneratedAtMs(item) >= profileGeneratedAtMs(existing)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => profileGeneratedAtMs(b) - profileGeneratedAtMs(a)
  );
}
