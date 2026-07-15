"use client";

export type CancelSubscriptionResult = {
  configured: boolean;
  ok: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  error?: string;
  code?: string;
};

export async function cancelSubscriptionOnServer(): Promise<CancelSubscriptionResult> {
  const { getAccessToken } = await import("./supabase/session");
  const token = await getAccessToken();
  if (!token) {
    return { configured: true, ok: false, error: "Unauthorized", code: "AUTH_REQUIRED" };
  }

  try {
    const res = await fetch("/api/subscription/cancel", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await res.json()) as CancelSubscriptionResult & { error?: string; code?: string };

    if (!res.ok) {
      return {
        configured: res.status !== 501,
        ok: false,
        error: data.error ?? `HTTP ${res.status}`,
        code: data.code,
      };
    }

    return {
      configured: true,
      ok: true,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
    };
  } catch (error) {
    return {
      configured: false,
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      code: "NETWORK_ERROR",
    };
  }
}
