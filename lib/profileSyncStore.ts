"use client";

import { create } from "zustand";

type ProfileSyncState = {
  ready: boolean;
  markReady: () => void;
  reset: () => void;
};

export const useProfileSyncStore = create<ProfileSyncState>()((set) => ({
  ready: false,
  markReady: () => set({ ready: true }),
  reset: () => set({ ready: false }),
}));
