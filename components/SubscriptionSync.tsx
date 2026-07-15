"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { hasServerActiveSubscription } from "@/lib/subscriptionAccess";
import {
  mirrorServerPlanToLocal,
  syncSubscriptionFromServer,
} from "@/lib/subscriptionSync";
import { useSubscriptionSyncStore } from "@/lib/subscriptionSyncStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasPrivateAccess } from "@/lib/privateAccess";

/** Loads subscription status from Supabase after auth — server is the source of truth. */
export function SubscriptionSync() {
  const isConfigured = useAuthStore((s) => s.isConfigured);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const markReady = useSubscriptionSyncStore((s) => s.markReady);
  const resetSync = useSubscriptionSyncStore((s) => s.reset);
  const setServerSubscription = useSubscriptionSyncStore((s) => s.setServerSubscription);

  useEffect(() => {
    if (hasPrivateAccess()) {
      markReady();
      return;
    }

    if (!isSupabaseConfigured() || !isConfigured) {
      markReady();
      return;
    }

    if (isLoading) return;

    if (!isAuthenticated) {
      resetSync();
      markReady();
      return;
    }

    let cancelled = false;
    resetSync();

    async function sync() {
      const result = await syncSubscriptionFromServer();
      const payload = result.payload;
      if (cancelled) return;

      setServerSubscription(payload);
      mirrorServerPlanToLocal(hasServerActiveSubscription(payload) ? payload : null);
      markReady();
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [isConfigured, isLoading, isAuthenticated, markReady, resetSync, setServerSubscription]);

  return null;
}
