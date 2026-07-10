"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Changer de thème"
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line text-cream/70 transition hover:border-copper/60 hover:text-copper ${className}`}
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
