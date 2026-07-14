"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "./appConfig";
import type { HairProfile } from "./mockAnalysis";

export type Answers = Record<string, string | string[] | number>;

interface HairAIState {
  answers: Answers;
  profile: HairProfile | null;
  history: HairProfile[];
  setAnswer: (key: string, value: string | string[] | number) => void;
  setProfile: (profile: HairProfile) => void;
  replaceFromServer: (data: {
    answers: Answers;
    profile: HairProfile | null;
    history: HairProfile[];
  }) => void;
  reset: () => void;
}

export const useHairAIStore = create<HairAIState>()(
  persist(
    (set) => ({
      answers: {},
      profile: null,
      history: [],
      setAnswer: (key, value) =>
        set((state) => ({ answers: { ...state.answers, [key]: value } })),
      setProfile: (profile) =>
        set((state) => ({
          profile,
          history: [...state.history, profile],
        })),
      replaceFromServer: (data) =>
        set({
          answers: data.answers,
          profile: data.profile,
          history: data.history,
        }),
      reset: () => set({ answers: {}, profile: null, history: [] }),
    }),
    { name: STORAGE_KEYS.profile }
  )
);
