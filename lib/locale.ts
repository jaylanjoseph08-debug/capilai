"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "./appConfig";

export type Locale = "fr" | "en";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

function applyLocale(locale: Locale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => {
        const safe = locale === "en" ? "en" : "fr";
        applyLocale(safe);
        set({ locale: safe });
      },
    }),
    {
      name: STORAGE_KEYS.locale,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.locale !== "fr" && state.locale !== "en") {
          state.locale = "en";
        }
        applyLocale(state.locale);
      },
    }
  )
);
