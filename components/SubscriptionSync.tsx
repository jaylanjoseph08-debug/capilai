"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { fetchSubscriptionFromServer, linkPendingSubscriptionFromServer } from "@/lib/subscriptionSync";
import { useSubscriptionSyncStore } from "@/lib/subscriptionSyncStore";
import { useSubscriptionStore } from "@/lib/subscriptionStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasPrivateAccess } from "@/lib/privateAccess";

/** Loads subscription status from Supabase after auth and syncs the local store. */
export function SubscriptionSync() {
  const isConfigured = useAuthStore((s) => s.isConfigured);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const markReady = useSubscriptionSyncStore((s) => s.markReady);
  const resetSync = useSubscriptionSyncStore((s) => s.reset);
  const setPlan = useSubscriptionStore((s) => s.setPlan);
  const cancelSubscription = useSubscriptionStore((s) => s.cancelSubscription);

  useEffect(() => {
    if (hasPrivateAccess()) {
      markReady(true);
      return;
    }

    if (!isSupabaseConfigured() || !isConfigured) {
      markReady(null);
      return;
    }

    if (isLoading) return;

    if (!isAuthenticated) {
      resetSync();
      markReady(null);
      return;
    }

    let cancelled = false;
    resetSync();

    async function sync() {
      await linkPendingSubscriptionFromServer();
      const payload = await fetchSubscriptionFromServer();
      if (cancelled) return;

      const active = Boolean(payload?.configured && payload.hasActiveSubscription && payload.plan);

      if (active && payload?.plan) {
        setPlan(payload.plan, payload.billingCycle ?? "annual");
        markReady(true);
        return;
      }

      cancelSubscription();
      markReady(false);
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [
    isConfigured,
    isLoading,
    isAuthenticated,
    markReady,
    resetSync,
    setPlan,
    cancelSubscription,
  ]);

  return null;
}
