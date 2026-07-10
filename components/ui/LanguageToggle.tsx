"use client";

import { useLocaleStore, type Locale } from "@/lib/locale";
import { LOCALE_LABELS } from "@/lib/i18n";

export function LanguageToggle({ compact }: { compact?: boolean }) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div
      className={`flex items-center rounded-full border border-line p-0.5 ${
        compact ? "gap-0" : "gap-0.5"
      }`}
      role="group"
      aria-label="Language"
    >
      {(["en", "fr"] as Locale[]).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          className={`rounded-full font-mono uppercase tracking-wider transition ${
            compact ? "px-2 py-1 text-[9px]" : "px-2.5 py-1 text-[10px]"
          } ${
            locale === value
              ? "bg-copper-gradient font-semibold text-ink"
              : "text-muted hover:text-cream"
          }`}
        >
          {compact ? value : LOCALE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}
