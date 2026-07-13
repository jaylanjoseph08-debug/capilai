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
import { useSelectedPlan, useSubscriptionStore, hasRecentCheckoutConfirmation } from "./subscriptionStore";

export function useHairScanQuota() {
  const plan = useSelectedPlan();
  const planConfirmedAt = useSubscriptionStore((s) => s.planConfirmedAt);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [status, setStatus] = useState<HairScanQuotaStatus | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (hasPrivateAccess()) {
      setStatus({ allowed: true, scansUsed: 0, scansLimit: null, remaining: null });
      setReady(true);
      return;
    }

    if (plan === null) {
      setStatus({ allowed: true, scansUsed: 0, scansLimit: null, remaining: null });
      setReady(true);
      return;
    }

    if (hasRecentCheckoutConfirmation(planConfirmedAt)) {
      setStatus(buildHairScanQuotaStatus(plan, 0));
      setReady(true);
      return;
    }

    if (!isAuthenticated) {
      setStatus(buildHairScanQuotaStatus(plan, 0));
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
  }, [plan, planConfirmedAt, isAuthenticated]);

  useEffect(() => {
    setReady(false);
    void refresh();
  }, [refresh]);

  const requiresAuth = Boolean(plan) && !isAuthenticated && !hasRecentCheckoutConfirmation(planConfirmedAt);

  const canStart = ready
    ? canStartHairScanLocally(plan, status, { planConfirmedAt, requiresAuth })
    : false;

  const consume = useCallback(async (): Promise<HairScanQuotaStatus | null> => {
    if (plan === null || hasPrivateAccess()) {
      return status;
    }

    if (hasRecentCheckoutConfirmation(planConfirmedAt)) {
      const next = buildHairScanQuotaStatus(plan, (status?.scansUsed ?? 0) + 1);
      setStatus(next);
      return next;
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
  }, [plan, planConfirmedAt, isAuthenticated, status]);

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
