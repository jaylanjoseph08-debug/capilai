"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { fetchSubscriptionFromServer, linkPendingSubscriptionFromServer } from "@/lib/subscriptionSync";
import { useSubscriptionSyncStore } from "@/lib/subscriptionSyncStore";
import { useSubscriptionStore, hasRecentCheckoutConfirmation } from "@/lib/subscriptionStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasPrivateAccess } from "@/lib/privateAccess";

const SERVER_SYNC_RETRY_DELAYS_MS = [2000, 3000, 5000, 8000];

async function loadServerSubscription() {
  await linkPendingSubscriptionFromServer();
  return fetchSubscriptionFromServer();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      let payload = await loadServerSubscription();
      if (cancelled) return;

      if (payload?.configured && payload.hasActiveSubscription && payload.plan) {
        setPlan(payload.plan, payload.billingCycle ?? "annual");
        markReady();
        return;
      }

      if (payload?.configured) {
        const local = useSubscriptionStore.getState();
        const awaitingWebhook =
          local.hasSelectedPlan &&
          local.plan &&
          hasRecentCheckoutConfirmation(local.planConfirmedAt);

        if (awaitingWebhook) {
          for (const delay of SERVER_SYNC_RETRY_DELAYS_MS) {
            await sleep(delay);
            if (cancelled) return;

            payload = await loadServerSubscription();
            if (payload?.configured && payload.hasActiveSubscription && payload.plan) {
              setPlan(payload.plan, payload.billingCycle ?? "annual");
              markReady();
              return;
            }
          }

          if (hasRecentCheckoutConfirmation(useSubscriptionStore.getState().planConfirmedAt)) {
            markReady();
            return;
          }
        }

        cancelSubscription();
      }

      markReady();
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
