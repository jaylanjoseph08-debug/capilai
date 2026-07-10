"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "./appConfig";

export type ThemeMode = "dark" | "light";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
}

function applyTheme(theme: ThemeMode) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: ThemeMode = get().theme === "dark" ? "light" : "dark";
        applyTheme(next);
        set({ theme: next });
      },
    }),
    {
      name: STORAGE_KEYS.theme,
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);
