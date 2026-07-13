"use client";

import type { Plan } from "./subscriptionStore";
import type { HairScanQuotaStatus } from "./hairScanLimits";

export type HairScanQuotaResponse = HairScanQuotaStatus & {
  configured: boolean;
  plan: Plan | null;
};

function toStatus(payload: HairScanQuotaResponse): HairScanQuotaStatus {
  return {
    allowed: payload.allowed,
    scansUsed: payload.scansUsed,
    scansLimit: payload.scansLimit,
    remaining: payload.remaining,
  };
}

async function authHeaders(): Promise<HeadersInit | null> {
  const { getAccessToken } = await import("./supabase/session");
  const token = await getAccessToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export async function fetchHairScanQuotaFromServer(): Promise<HairScanQuotaStatus | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  try {
    const res = await fetch("/api/hair-scan/quota", { headers, cache: "no-store" });
    if (res.status === 401) return null;
    if (!res.ok) return null;

    const data = (await res.json()) as HairScanQuotaResponse;
    if (!data.configured) return null;
    return toStatus(data);
  } catch {
    return null;
  }
}

export async function consumeHairScanOnServer(): Promise<HairScanQuotaStatus | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  try {
    const res = await fetch("/api/hair-scan/consume", {
      method: "POST",
      headers,
    });

    if (res.status === 401) return null;

    const data = (await res.json()) as HairScanQuotaResponse & { error?: string; code?: string };
    if (!data.configured) return null;
    if (!res.ok) return toStatus(data);

    return toStatus(data);
  } catch {
    return null;
  }
}
