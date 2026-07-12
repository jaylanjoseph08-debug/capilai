"use client";

import { create } from "zustand";

type SubscriptionSyncState = {
  /** True once server sync finished (or skipped when Supabase is off). */
  ready: boolean;
  /** Server-side active subscription; null until sync completes for signed-in users. */
  hasActiveSubscription: boolean | null;
  markReady: (hasActiveSubscription?: boolean | null) => void;
  reset: () => void;
};

export const useSubscriptionSyncStore = create<SubscriptionSyncState>()((set) => ({
  ready: false,
  hasActiveSubscription: null,
  markReady: (hasActiveSubscription = null) =>
    set({ ready: true, hasActiveSubscription }),
  reset: () => set({ ready: false, hasActiveSubscription: null }),
}));
