"use client";

import { hasPrivateAccess } from "./privateAccess";
import { hasPaidAccess } from "./subscriptionAccess";
import { fetchSubscriptionFromServer, linkPendingSubscriptionFromServer } from "./subscriptionSync";
import { isSupabaseConfigured } from "./supabase/client";
import { getSelectedPlan, useSubscriptionStore } from "./subscriptionStore";
import { useAuthStore } from "./authStore";

export const POST_LOGIN_PRICING_PATH = "/pricing?from=login";
export const PROFILE_PRICING_PATH = "/pricing?from=profile";

/** Resolves where to send the user right after a successful login. */
export async function resolvePostLoginPath(intendedPath = "/dashboard"): Promise<string> {
  if (hasPrivateAccess()) return intendedPath;
  if (!isSupabaseConfigured()) return intendedPath;

  await linkPendingSubscriptionFromServer();
  const payload = await fetchSubscriptionFromServer();
  const { setPlan, cancelSubscription } = useSubscriptionStore.getState();

  if (!payload?.configured) return intendedPath;

  if (payload.hasActiveSubscription && payload.plan) {
    setPlan(payload.plan, payload.billingCycle ?? "annual");
    return intendedPath;
  }

  cancelSubscription();
  return POST_LOGIN_PRICING_PATH;
}

/** Resolves where to send the user when opening their profile from the home page. */
export async function resolveProfileEntryPath(): Promise<string> {
  if (hasPrivateAccess()) return "/dashboard";

  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  if (isAuthenticated) {
    const path = await resolvePostLoginPath("/dashboard");
    return path === POST_LOGIN_PRICING_PATH ? PROFILE_PRICING_PATH : path;
  }

  const { plan, hasSelectedPlan } = useSubscriptionStore.getState();
  if (hasPaidAccess(getSelectedPlan(plan, hasSelectedPlan))) {
    return "/dashboard";
  }

  return PROFILE_PRICING_PATH;
}
