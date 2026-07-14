"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "./appConfig";
import type { Plan, BillingCycle } from "./plans";
import type { SubscriptionMePayload } from "./subscriptionSync";

export type { Plan, BillingCycle } from "./plans";
export { useSelectedPlan } from "./useSelectedPlan";

interface SubscriptionState {
  plan: Plan | null;
  /** True only after the user explicitly chose a plan on /pricing. */
  hasSelectedPlan: boolean;
  billingCycle: BillingCycle;
  /** Set after Stripe checkout until the server subscription is confirmed. */
  planConfirmedAt: number | null;
  setPlan: (plan: Plan, billingCycle?: BillingCycle, options?: { checkout?: boolean }) => void;
  cancelSubscription: () => void;
}

type PersistedSubscriptionState = {
  plan?: Plan | null;
  hasSelectedPlan?: boolean;
  billingCycle?: BillingCycle;
  planConfirmedAt?: number | null;
};

export const SUBSCRIPTION_SYNC_GRACE_MS = 120_000;

export function hasRecentCheckoutConfirmation(planConfirmedAt: number | null | undefined): boolean {
  if (!planConfirmedAt) return false;
  return Date.now() - planConfirmedAt < SUBSCRIPTION_SYNC_GRACE_MS;
}

export function getSelectedPlan(plan: Plan | null, hasSelectedPlan: boolean): Plan | null {
  return hasSelectedPlan ? plan : null;
}

/** Mirror server subscription into the local cache (UI display only). */
export function mirrorServerPlanToLocal(payload: SubscriptionMePayload | null): void {
  const { setPlan, cancelSubscription } = useSubscriptionStore.getState();
  if (payload?.hasActiveSubscription && payload.plan) {
    setPlan(payload.plan, payload.billingCycle ?? "annual");
    return;
  }
  cancelSubscription();
}

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Découverte",
  premium: "Essentiel",
  pro: "Premium",
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      plan: null,
      hasSelectedPlan: false,
      billingCycle: "annual",
      planConfirmedAt: null,
      setPlan: (plan, billingCycle, options) =>
        set((state) => ({
          plan,
          hasSelectedPlan: true,
          billingCycle: billingCycle ?? state.billingCycle,
          planConfirmedAt: options?.checkout ? Date.now() : null,
        })),
      cancelSubscription: () =>
        set({ plan: null, hasSelectedPlan: false, billingCycle: "annual", planConfirmedAt: null }),
    }),
    {
      name: STORAGE_KEYS.subscription,
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as PersistedSubscriptionState;
        if (version < 1) {
          if (state.hasSelectedPlan) {
            return { ...state, hasSelectedPlan: true, planConfirmedAt: null };
          }
          if (state.plan === "free") {
            return { ...state, plan: null, hasSelectedPlan: false, planConfirmedAt: null };
          }
          if (state.plan === "premium" || state.plan === "pro") {
            return { ...state, hasSelectedPlan: true, planConfirmedAt: null };
          }
          return { ...state, plan: null, hasSelectedPlan: false, planConfirmedAt: null };
        }
        if (version < 2) {
          return { ...state, planConfirmedAt: state.planConfirmedAt ?? null };
        }
        return persistedState as SubscriptionState;
      },
    }
  )
);
