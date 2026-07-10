"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelectedPlan } from "./subscriptionStore";
import { useSubscriptionSyncStore } from "./subscriptionSyncStore";
import { hasPaidAccess } from "./subscriptionAccess";

/** Redirects to pricing when the user has not subscribed to a paid plan. */
export function useRequirePaidAccess(): boolean {
  const router = useRouter();
  const plan = useSelectedPlan();
  const syncReady = useSubscriptionSyncStore((s) => s.ready);
  const allowed = hasPaidAccess(plan);

  useEffect(() => {
    if (!syncReady) return;
    if (!allowed) {
      router.replace("/pricing?from=diagnostic");
    }
  }, [allowed, syncReady, router]);

  return syncReady && allowed;
}
