"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "./authStore";
import { hasPrivateAccess } from "./privateAccess";
import {
  buildHairScanQuotaStatus,
  type HairScanQuotaStatus,
} from "./hairScanLimits";
import { canStartHairScanLocally } from "./hairScanQuota";
import { consumeHairScanOnServer, fetchHairScanQuotaFromServer } from "./hairScanQuotaSync";
import { useSelectedPlan } from "./useSelectedPlan";
import { useSubscriptionSyncStore } from "./subscriptionSyncStore";

export function useHairScanQuota() {
  const plan = useSelectedPlan();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const syncReady = useSubscriptionSyncStore((s) => s.ready);
  const [status, setStatus] = useState<HairScanQuotaStatus | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (hasPrivateAccess()) {
      setStatus({ allowed: true, scansUsed: 0, scansLimit: null, remaining: null });
      setReady(true);
      return;
    }

    if (!isAuthenticated) {
      setStatus({ allowed: plan === null, scansUsed: 0, scansLimit: null, remaining: null });
      setReady(true);
      return;
    }

    if (!syncReady) {
      return;
    }

    if (plan === null) {
      setStatus({ allowed: true, scansUsed: 0, scansLimit: null, remaining: null });
      setReady(true);
      return;
    }

    const remote = await fetchHairScanQuotaFromServer();
    if (remote) {
      setStatus(remote);
    } else {
      setStatus(buildHairScanQuotaStatus(plan, 0));
    }
    setReady(true);
  }, [plan, isAuthenticated, syncReady]);

  useEffect(() => {
    setReady(false);
    void refresh();
  }, [refresh]);

  const requiresAuth = !hasPrivateAccess() && !isAuthenticated;

  const canStart = ready
    ? canStartHairScanLocally(plan, status, { requiresAuth })
    : false;

  const consume = useCallback(async (): Promise<HairScanQuotaStatus | null> => {
    if (plan === null || hasPrivateAccess()) {
      return status;
    }

    if (!isAuthenticated) {
      return status;
    }

    const next = await consumeHairScanOnServer();
    if (next) {
      setStatus(next);
      return next;
    }

    return status;
  }, [plan, isAuthenticated, status]);

  return {
    plan,
    status,
    ready,
    canStart,
    requiresAuth,
    refresh,
    consume,
  };
}
