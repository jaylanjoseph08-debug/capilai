"use client";

import type { BillingCycle, Plan } from "./subscriptionStore";

export type SubscriptionMePayload = {
  configured: boolean;
  hasActiveSubscription: boolean;
  plan: Plan | null;
  billingCycle: BillingCycle | null;
  status: string | null;
};

export async function fetchSubscriptionFromServer(): Promise<SubscriptionMePayload | null> {
  const { getAccessToken } = await import("./supabase/session");
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch("/api/subscription/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (res.status === 401) return null;
    if (!res.ok) return null;

    return (await res.json()) as SubscriptionMePayload;
  } catch {
    return null;
  }
}

/** Links a guest Stripe checkout (same email) to the authenticated user. */
export async function linkPendingSubscriptionFromServer(): Promise<boolean> {
  const { getAccessToken } = await import("./supabase/session");
  const token = await getAccessToken();
  if (!token) return false;

  try {
    const res = await fetch("/api/subscription/link", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { linked?: boolean };
    return Boolean(data.linked);
  } catch {
    return false;
  }
}
