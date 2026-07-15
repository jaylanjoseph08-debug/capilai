"use client";

import type { BillingCycle, Plan } from "./subscriptionStore";
import { mirrorServerPlanToLocal } from "./subscriptionStore";

export type SubscriptionMePayload = {
  configured: boolean;
  hasActiveSubscription: boolean;
  plan: Plan | null;
  billingCycle: BillingCycle | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canCancel: boolean;
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

export async function syncSubscriptionFromServer(): Promise<SubscriptionMePayload | null> {
  await linkPendingSubscriptionFromServer();
  return fetchSubscriptionFromServer();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_POLL_DELAYS_MS = [1000, 2000, 3000, 5000, 8000, 10000, 15000];

/** Poll Supabase until an active subscription appears (post-Stripe webhook). */
export async function pollSubscriptionUntilActive(
  delaysMs: readonly number[] = DEFAULT_POLL_DELAYS_MS
): Promise<SubscriptionMePayload | null> {
  let payload = await syncSubscriptionFromServer();
  if (payload?.configured && payload.hasActiveSubscription && payload.plan) {
    return payload;
  }

  for (const delay of delaysMs) {
    await sleep(delay);
    payload = await syncSubscriptionFromServer();
    if (payload?.configured && payload.hasActiveSubscription && payload.plan) {
      return payload;
    }
  }

  return payload;
}

export { mirrorServerPlanToLocal } from "./subscriptionStore";
