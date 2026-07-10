"use client";

import { create } from "zustand";

type SubscriptionSyncState = {
  /** True once server sync finished (or skipped when Supabase is off). */
  ready: boolean;
  markReady: () => void;
  reset: () => void;
};

export const useSubscriptionSyncStore = create<SubscriptionSyncState>()((set) => ({
  ready: false,
  markReady: () => set({ ready: true }),
  reset: () => set({ ready: false }),
}));
