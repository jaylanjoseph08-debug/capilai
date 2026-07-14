"use client";

import { create } from "zustand";
import type { SubscriptionMePayload } from "./subscriptionSync";

type SubscriptionSyncState = {
  /** True once server sync finished (or skipped when Supabase is off). */
  ready: boolean;
  /** Authoritative subscription state from Supabase (when configured). */
  serverSubscription: SubscriptionMePayload | null;
  markReady: () => void;
  reset: () => void;
  setServerSubscription: (payload: SubscriptionMePayload | null) => void;
};

export const useSubscriptionSyncStore = create<SubscriptionSyncState>()((set) => ({
  ready: false,
  serverSubscription: null,
  markReady: () => set({ ready: true }),
  reset: () => set({ ready: false, serverSubscription: null }),
  setServerSubscription: (payload) => set({ serverSubscription: payload }),
}));
