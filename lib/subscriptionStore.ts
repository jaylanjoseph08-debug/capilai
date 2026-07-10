"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "./appConfig";

export type Plan = "free" | "premium" | "pro";
export type BillingCycle = "monthly" | "annual";

interface SubscriptionState {
  plan: Plan | null;
  /** True only after the user explicitly chose a plan on /pricing. */
  hasSelectedPlan: boolean;
  billingCycle: BillingCycle;
  setPlan: (plan: Plan, billingCycle?: BillingCycle) => void;
  cancelSubscription: () => void;
}

type PersistedSubscriptionState = {
  plan?: Plan | null;
  hasSelectedPlan?: boolean;
  billingCycle?: BillingCycle;
};

export function getSelectedPlan(plan: Plan | null, hasSelectedPlan: boolean): Plan | null {
  return hasSelectedPlan ? plan : null;
}

export function useSelectedPlan(): Plan | null {
  return useSubscriptionStore((s) => getSelectedPlan(s.plan, s.hasSelectedPlan));
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
      setPlan: (plan, billingCycle) =>
        set((state) => ({
          plan,
          hasSelectedPlan: true,
          billingCycle: billingCycle ?? state.billingCycle,
        })),
      cancelSubscription: () => set({ plan: null, hasSelectedPlan: false, billingCycle: "annual" }),
    }),
    {
      name: STORAGE_KEYS.subscription,
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as PersistedSubscriptionState;
        if (version < 1) {
          if (state.hasSelectedPlan) {
            return { ...state, hasSelectedPlan: true };
          }
          if (state.plan === "free") {
            return { ...state, plan: null, hasSelectedPlan: false };
          }
          if (state.plan === "premium" || state.plan === "pro") {
            return { ...state, hasSelectedPlan: true };
          }
          return { ...state, plan: null, hasSelectedPlan: false };
        }
        return persistedState as SubscriptionState;
      },
    }
  )
);
