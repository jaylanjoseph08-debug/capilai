"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format } from "date-fns";
import { Printer, TrendingUp } from "lucide-react";
import { useHairAIStore } from "@/lib/store";
import { getProfileForLocale } from "@/lib/profileDisplay";
import { getCatalog } from "@/lib/products";
import { computeCompatibility } from "@/lib/compatibility";
import { dateFnsLocale } from "@/lib/i18n";
import { useTranslation } from "@/lib/useTranslation";
import { useRequirePaidAccess } from "@/lib/useRequirePaidAccess";
import { BottomNav } from "@/components/ui/BottomNav";

export default function ReportPage() {
  const allowed = useRequirePaidAccess();
  const { locale, t } = useTranslation();
  const { profile: storedProfile, answers, history } = useHairAIStore();
  const profile = useMemo(
    () => (storedProfile ? getProfileForLocale(storedProfile, answers, locale) : null),
    [storedProfile, answers, locale]
  );
  const dfLocale = dateFnsLocale(locale);

  if (!allowed) return null;

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-radial px-6 text-center">
        <h1 className="font-display text-2xl text-cream">{t("report.noReport")}</h1>
        <p className="max-w-xs font-body text-sm text-muted">{t("report.noReportText")}</p>
        <Link href="/" className="flex h-14 items-center rounded-full bg-copper-gradient px-8 font-body text-sm font-semibold text-ink shadow-glow">
          {t("report.startDiagnostic")}
        </Link>
      </main>
    );
  }

  const recommended = getCatalog(locale)
    .map((product) => ({ product, compat: computeCompatibility(product, profile, answers) }))
    .sort((a, b) => b.compat.score - a.compat.score)
    .slice(0, 3);

  const trend = history.length >= 2 ? history[history.length - 1].score - history[0].score : null;
  const reportDate = format(new Date(profile.generatedAt), "d MMMM yyyy", { locale: dfLocale });

  return (
    <main className="min-h-screen bg-ink-radial px-6 pb-28 pt-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
            ← {t("common.dashboard")}
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper"
          >
            <Printer size={13} /> {t("common.printPdf")}
          </button>
        </div>

        <h1 className="font-display text-2xl font-medium text-cream">
          {t("report.title").replace("{date}", reportDate)}
        </h1>

        <Section title={t("report.summary")}>
          <p className="font-body text-sm leading-relaxed text-cream/80">{profile.report.summary}</p>
        </Section>

        <Section title={t("report.strengths")}>
          <BulletList items={profile.report.strengths} tone="positive" />
        </Section>

        <Section title={t("report.weaknesses")}>
          <BulletList items={profile.report.weaknesses} tone="negative" />
        </Section>

        <Section title={t("report.causes")}>
          <BulletList items={profile.report.probableCauses} tone="neutral" />
        </Section>

        <Section title={t("report.advice")}>
          <BulletList items={profile.report.advice} tone="neutral" />
        </Section>

        <Section title={t("report.goals")}>
          <div className="flex flex-wrap gap-2">
            {profile.priorities.map((p) => (
              <span key={p} className="rounded-full border border-copper/30 bg-copper/10 px-4 py-2 font-body text-xs text-copper-light">
                {p}
              </span>
            ))}
          </div>
        </Section>

        <Section title={t("report.fullRoutine")}>
          <div className="glass rounded-3xl p-5">
            <RoutineBlock title={t("dashboard.morning")} items={profile.routine.morning} />
            <RoutineBlock title={t("dashboard.evening")} items={profile.routine.evening} />
            <RoutineBlock title={t("dashboard.washDay")} items={profile.routine.washDay} />
            <RoutineBlock title={t("report.masks")} items={profile.routine.masks} />
            <RoutineBlock title={t("report.oils")} items={profile.routine.oils} last />
          </div>
        </Section>

        <Section title={t("report.recommendedProducts")}>
          <div className="flex flex-col gap-2">
            {recommended.map(({ product, compat }) => (
              <div key={product.barcode} className="glass flex items-center justify-between rounded-2xl p-4">
                <div className="min-w-0">
                  <p className="truncate font-body text-sm text-cream">{product.name}</p>
                  <p className="truncate font-body text-xs text-muted">{product.brand}</p>
                </div>
                <span className="flex-shrink-0 font-mono text-xs text-copper-light">{compat.score}/100</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("report.evolution")}>
          {trend === null ? (
            <p className="font-body text-sm text-muted">{t("report.singleAnalysis")}</p>
          ) : (
            <div className="glass flex items-center gap-3 rounded-2xl p-4">
              <TrendingUp size={18} className={trend >= 0 ? "text-copper-light" : "text-muted"} />
              <p className="font-body text-sm text-cream/80">
                {t("report.trendUp").replace("+{delta}", `${trend >= 0 ? "+" : ""}${trend}`)}{" "}
                <Link href="/historique" className="text-copper-light underline underline-offset-2 print:hidden">
                  {t("report.seeDetail")}
                </Link>
              </p>
            </div>
          )}
        </Section>
      </div>
      <BottomNav />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h2 className="mb-3 font-display text-lg text-cream">{title}</h2>
      {children}
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: "positive" | "negative" | "neutral" }) {
  const color = tone === "positive" ? "#8FBF8A" : tone === "negative" ? "#D97757" : "#E8B86D";
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 font-body text-sm text-cream/80">
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function RoutineBlock({ title, items, last }: { title: string; items: string[]; last?: boolean }) {
  return (
    <div className={!last ? "mb-5 border-b border-line pb-5" : ""}>
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-copper-light">{title}</span>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="font-body text-sm text-cream/80">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
