"use client";

import { useEffect, useState } from "react";
import { useLocaleStore } from "./locale";
import { t, type TranslationKey, planLabel } from "./i18n";
import type { Plan } from "./subscriptionStore";

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const activeLocale = hydrated ? locale : "en";

  return {
    locale: activeLocale,
    hydrated,
    t: (key: TranslationKey) => t(activeLocale, key),
    planLabel: (plan: Plan | null) => (plan ? planLabel(activeLocale, plan) : t(activeLocale, "settings.noPlan")),
  };
}
