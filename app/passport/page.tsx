"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo } from "react";
import { useHairAIStore } from "@/lib/store";
import { getProfileForLocale } from "@/lib/profileDisplay";
import { dateFnsLocale } from "@/lib/i18n";
import { useTranslation } from "@/lib/useTranslation";
import { useRequirePaidAccess } from "@/lib/useRequirePaidAccess";
import { BottomNav } from "@/components/ui/BottomNav";

export default function PassportPage() {
  const allowed = useRequirePaidAccess();
  const { locale, t } = useTranslation();
  const { history, answers } = useHairAIStore();
  const ordered = useMemo(
    () => [...history].reverse().map((profile) => getProfileForLocale(profile, answers, locale)),
    [history, answers, locale]
  );
  const dfLocale = dateFnsLocale(locale);

  if (!allowed) return null;

  return (
    <main className="min-h-screen bg-ink-radial px-6 pb-28 pt-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
            ← {t("common.dashboard")}
          </Link>
          <span className="font-display text-lg italic text-cream">{t("passport.title")}</span>
        </div>

        {history.length >= 2 && (
          <Link
            href="/historique"
            className="glass mb-6 flex items-center justify-between rounded-3xl p-4 transition hover:border-copper/30"
          >
            <span className="font-body text-sm text-cream">{t("passport.seeEvolution")}</span>
            <span className="text-copper-light">→</span>
          </Link>
        )}

        {ordered.length === 0 && (
          <p className="mt-16 text-center font-body text-sm text-muted">{t("passport.noAnalysis")}</p>
        )}

        <div className="relative ml-3 border-l border-line pl-6">
          {ordered.map((profile, i) => (
            <div key={profile.generatedAt} className="relative mb-8">
              <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-copper bg-ink" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                {format(new Date(profile.generatedAt), "Pp", { locale: dfLocale })}
              </span>
              <div className="glass mt-2 rounded-3xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl text-cream">{profile.score}</span>
                  <span className="font-body text-xs text-muted">
                    {i === ordered.length - 1
                      ? t("passport.firstAnalysis")
                      : t("passport.analysisN").replace("{n}", String(ordered.length - i))}
                  </span>
                </div>
                <p className="mt-2 font-body text-xs leading-relaxed text-muted">{profile.report.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
