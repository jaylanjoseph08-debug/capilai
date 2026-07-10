"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHairAIStore } from "@/lib/store";
import { useThemeStore } from "@/lib/theme";
import { dateFnsLocale, type TranslationKey } from "@/lib/i18n";
import { useTranslation } from "@/lib/useTranslation";
import { useRequirePaidAccess } from "@/lib/useRequirePaidAccess";
import { BottomNav } from "@/components/ui/BottomNav";

const METRIC_KEYS = [
  "health",
  "hydration",
  "density",
  "porosity",
  "volume",
  "thickness",
  "elasticity",
  "scalp",
] as const;

function useChartColors() {
  const theme = useThemeStore((s) => s.theme);
  return theme === "light"
    ? { text: "#1C1612", muted: "#786A60", grid: "rgba(28,22,18,0.1)", surface: "#FFFFFF" }
    : { text: "#F5EFE6", muted: "#93867B", grid: "rgba(245,239,230,0.1)", surface: "#1A1613" };
}

function getHistoriqueMetricLabels(t: (key: TranslationKey) => string): Record<string, string> {
  return Object.fromEntries(
    METRIC_KEYS.map((key) => [key, t(`historique.metrics.${key}` as TranslationKey)])
  );
}

export default function HistoriquePage() {
  const allowed = useRequirePaidAccess();
  const { locale, t } = useTranslation();
  const { history } = useHairAIStore();
  const colors = useChartColors();
  const dfLocale = dateFnsLocale(locale);
  const metricLabels = getHistoriqueMetricLabels(t);

  if (!allowed) return null;

  return (
    <main className="min-h-screen bg-ink-radial px-6 pb-28 pt-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
            ← {t("common.dashboard")}
          </Link>
          <span className="font-display text-lg italic text-cream">{t("historique.title")}</span>
        </div>

        {history.length === 0 && (
          <EmptyState title={t("historique.emptyTitle")} text={t("historique.emptyText")} cta={t("historique.launchAnalysis")} />
        )}

        {history.length === 1 && (
          <EmptyState title={t("historique.singleTitle")} text={t("historique.singleText")} cta={t("historique.launchAnalysis")} />
        )}

        {history.length >= 2 && (
          <>
            <AvantApres history={history} dfLocale={dfLocale} t={t} />

            <h2 className="mb-3 mt-8 font-display text-lg text-cream">{t("historique.scoreEvolution")}</h2>
            <div className="glass mb-8 rounded-3xl p-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={history.map((p) => ({
                    date: format(new Date(p.generatedAt), "d MMM", { locale: dfLocale }),
                    score: p.score,
                  }))}
                >
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: colors.muted, fontSize: 10 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: colors.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: colors.surface, border: "1px solid " + colors.grid, borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: colors.text }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#C97C4B" strokeWidth={2.5} dot={{ fill: "#E8B86D", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <h2 className="mb-3 font-display text-lg text-cream">{t("historique.metricComparison")}</h2>
            <div className="glass mb-4 rounded-3xl p-4">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={buildRadarData(history, metricLabels)}>
                  <PolarGrid stroke={colors.grid} />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: colors.muted, fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={t("historique.before")} dataKey="avant" stroke={colors.muted} fill={colors.muted} fillOpacity={0.15} />
                  <Radar name={t("historique.after")} dataKey="apres" stroke="#C97C4B" fill="#C97C4B" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-6">
                <Legend swatch={colors.muted} label={t("historique.firstAnalysisLegend")} />
                <Legend swatch="#C97C4B" label={t("historique.lastAnalysisLegend")} />
              </div>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2 font-body text-xs text-muted">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch }} />
      {label}
    </span>
  );
}

function AvantApres({
  history,
  dfLocale,
  t,
}: {
  history: import("@/lib/mockAnalysis").HairProfile[];
  dfLocale: ReturnType<typeof dateFnsLocale>;
  t: (key: TranslationKey) => string;
}) {
  const first = history[0];
  const last = history[history.length - 1];
  const delta = last.score - first.score;

  return (
    <div className="glass flex items-center justify-between rounded-4xl p-6">
      <ScoreBlock label={t("historique.before")} date={first.generatedAt} score={first.score} dfLocale={dfLocale} />
      <div className="flex flex-col items-center px-3">
        <span className={`font-mono text-xs ${delta >= 0 ? "text-copper-light" : "text-muted"}`}>
          {delta >= 0 ? "+" : ""}
          {delta}
        </span>
        <span className="mt-1 text-muted">→</span>
      </div>
      <ScoreBlock label={t("historique.after")} date={last.generatedAt} score={last.score} dfLocale={dfLocale} />
    </div>
  );
}

function ScoreBlock({
  label,
  date,
  score,
  dfLocale,
}: {
  label: string;
  date: string;
  score: number;
  dfLocale: ReturnType<typeof dateFnsLocale>;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</span>
      <span className="font-display text-3xl text-cream">{score}</span>
      <span className="mt-1 font-body text-[11px] text-muted">{format(new Date(date), "d MMM yyyy", { locale: dfLocale })}</span>
    </div>
  );
}

function buildRadarData(
  history: import("@/lib/mockAnalysis").HairProfile[],
  metricLabels: Record<string, string>
) {
  const first = history[0];
  const last = history[history.length - 1];
  return Object.keys(first.metrics).map((key) => ({
    metric: metricLabels[key] ?? key,
    avant: first.metrics[key as keyof typeof first.metrics],
    apres: last.metrics[key as keyof typeof last.metrics],
  }));
}

function EmptyState({ title, text, cta }: { title: string; text: string; cta: string }) {
  return (
    <div className="glass flex flex-col items-center rounded-4xl px-6 py-14 text-center">
      <p className="mb-2 font-display text-lg text-cream">{title}</p>
      <p className="mb-6 max-w-xs font-body text-sm text-muted">{text}</p>
      <Link
        href="/"
        className="flex h-12 items-center rounded-full bg-copper-gradient px-6 font-body text-sm font-semibold text-ink shadow-glow"
      >
        {cta}
      </Link>
    </div>
  );
}
