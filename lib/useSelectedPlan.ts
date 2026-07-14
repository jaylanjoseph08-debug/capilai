"use client";

import type { Plan } from "./subscriptionStore";
import { hasPrivateAccess } from "./privateAccess";
import { isSupabaseConfigured } from "./supabase/client";
import { useAuthStore } from "./authStore";
import { hasServerActiveSubscription } from "./subscriptionAccess";
import { getSelectedPlan, useSubscriptionStore } from "./subscriptionStore";
import { useSubscriptionSyncStore } from "./subscriptionSyncStore";

/** Active plan from Supabase when configured; local cache fallback in demo mode. */
export function useSelectedPlan(): Plan | null {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const syncReady = useSubscriptionSyncStore((s) => s.ready);
  const serverSubscription = useSubscriptionSyncStore((s) => s.serverSubscription);
  const localPlan = useSubscriptionStore((s) => getSelectedPlan(s.plan, s.hasSelectedPlan));

  if (hasPrivateAccess()) {
    return localPlan ?? "pro";
  }

  if (isSupabaseConfigured() && isAuthenticated) {
    if (!syncReady) return null;
    if (serverSubscription?.configured) {
      return hasServerActiveSubscription(serverSubscription) ? serverSubscription.plan : null;
    }
  }

  if (syncReady) return localPlan;
  return null;
}
