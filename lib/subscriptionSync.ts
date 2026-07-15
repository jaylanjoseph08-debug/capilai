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

export type ActivateSubscriptionResult =
  | { ok: true; payload: SubscriptionMePayload }
  | { ok: false; code: string; error: string };

export type SyncSubscriptionResult = {
  payload: SubscriptionMePayload | null;
  activateError?: { code: string; error: string };
};

const NON_RETRYABLE_ACTIVATE_CODES = new Set([
  "AUTH_REQUIRED",
  "USER_MISMATCH",
  "MISSING_PLAN",
  "PAYMENT_INCOMPLETE",
  "SESSION_INCOMPLETE",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait for Supabase session restore after Stripe redirect. */
export async function waitForAccessToken(maxWaitMs = 8000): Promise<string | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const { getAccessToken } = await import("./supabase/session");
    const token = await getAccessToken();
    if (token) return token;
    await sleep(250);
  }
  return null;
}

export async function fetchSubscriptionFromServer(): Promise<SubscriptionMePayload | null> {
  const { getAccessToken } = await import("./supabase/session");
  const authToken = await getAccessToken();
  if (!authToken) return null;

  try {
    const res = await fetch("/api/subscription/me", {
      headers: { Authorization: `Bearer ${authToken}` },
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
export async function linkPendingSubscriptionFromServer(sessionId?: string): Promise<boolean> {
  const token = await waitForAccessToken();
  if (!token) return false;

  try {
    const res = await fetch("/api/subscription/link", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionId ? { sessionId } : {}),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { linked?: boolean };
    return Boolean(data.linked);
  } catch {
    return false;
  }
}

/** Force activation from the Stripe Checkout session (post-payment fallback). */
export async function activateSubscriptionFromCheckoutSession(
  sessionId: string
): Promise<ActivateSubscriptionResult> {
  const token = await waitForAccessToken();
  if (!token) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      error: "Sign in to activate your subscription.",
    };
  }

  try {
    const res = await fetch("/api/subscription/activate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    const data = (await res.json()) as SubscriptionMePayload & { error?: string; code?: string };

    if (!res.ok) {
      return {
        ok: false,
        code: data.code ?? "ACTIVATION_FAILED",
        error: data.error ?? "Activation failed",
      };
    }

    return { ok: true, payload: data };
  } catch (error) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function syncSubscriptionFromServer(sessionId?: string): Promise<SyncSubscriptionResult> {
  if (sessionId) {
    const activated = await activateSubscriptionFromCheckoutSession(sessionId);
    if (activated.ok) {
      return { payload: activated.payload };
    }

    if (NON_RETRYABLE_ACTIVATE_CODES.has(activated.code)) {
      return {
        payload: null,
        activateError: { code: activated.code, error: activated.error },
      };
    }
  }

  await linkPendingSubscriptionFromServer(sessionId);
  return { payload: await fetchSubscriptionFromServer() };
}

const DEFAULT_POLL_DELAYS_MS = [1500, 2500, 4000, 6000, 8000];

/** Poll Supabase until an active subscription appears (post-Stripe webhook). */
export async function pollSubscriptionUntilActive(
  sessionId?: string,
  delaysMs: readonly number[] = DEFAULT_POLL_DELAYS_MS
): Promise<SyncSubscriptionResult> {
  let result = await syncSubscriptionFromServer(sessionId);
  if (result.activateError) return result;

  if (result.payload?.configured && result.payload.hasActiveSubscription && result.payload.plan) {
    return result;
  }

  for (const delay of delaysMs) {
    await sleep(delay);
    result = await syncSubscriptionFromServer(sessionId);
    if (result.activateError) return result;
    if (result.payload?.configured && result.payload.hasActiveSubscription && result.payload.plan) {
      return result;
    }
  }

  return result;
}

export { mirrorServerPlanToLocal } from "./subscriptionStore";
