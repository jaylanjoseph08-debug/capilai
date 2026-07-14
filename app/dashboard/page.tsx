"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, PackagePlus, CalendarDays, ScrollText, Camera, History } from "lucide-react";
import { useHairAIStore } from "@/lib/store";
import { useAuthStore } from "@/lib/authStore";
import { useSelectedPlan } from "@/lib/useSelectedPlan";
import { useSubscriptionSyncStore } from "@/lib/subscriptionSyncStore";
import { useProfileSyncStore } from "@/lib/profileSyncStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasPaidAccess } from "@/lib/subscriptionAccess";
import { getMetricLabels } from "@/lib/i18n";
import { getProfileForLocale } from "@/lib/profileDisplay";
import { StrandGauge } from "@/components/ui/StrandGauge";
import { MetricCard } from "@/components/ui/MetricCard";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BottomNav } from "@/components/ui/BottomNav";
import { useTranslation } from "@/lib/useTranslation";
import { pricingUrlForScanLimit, loginUrlForScan } from "@/lib/hairScanQuota";
import { useHairScanQuota } from "@/lib/useHairScanQuota";

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-ink-radial" />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const plan = useSelectedPlan();
  const { canStart, requiresAuth } = useHairScanQuota();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const syncReady = useSubscriptionSyncStore((s) => s.ready);
  const profileSyncReady = useProfileSyncStore((s) => s.ready);
  const waitingForProfile = isSupabaseConfigured() && isAuthenticated && !profileSyncReady;
  const metricLabels = getMetricLabels(locale);
  const { profile: storedProfile, answers } = useHairAIStore();
  const profile = useMemo(
    () => (storedProfile ? getProfileForLocale(storedProfile, answers, locale) : null),
    [storedProfile, answers, locale]
  );

  useEffect(() => {
    if (!syncReady) return;
    if (profile && !hasPaidAccess(plan)) {
      router.replace("/pricing?from=diagnostic");
    }
  }, [profile, plan, syncReady, router]);

  if (!syncReady || waitingForProfile) {
    return null;
  }

  if (profile && !hasPaidAccess(plan)) {
    return null;
  }

  function handleScanHairClick() {
    if (requiresAuth) {
      router.push(loginUrlForScan());
      return;
    }
    if (!canStart) {
      router.push(pricingUrlForScanLimit(plan));
      return;
    }
    router.push("/scan");
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-radial px-6 pb-24 text-center">
        <h1 className="font-display text-2xl text-cream">{t("dashboard.noProfileTitle")}</h1>
        <p className="max-w-xs font-body text-sm text-muted">{t("dashboard.noProfileText")}</p>
        <Link
          href="/"
          className="flex h-14 items-center justify-center rounded-full bg-copper-gradient px-8 font-body text-sm font-semibold text-ink shadow-glow"
        >
          {t("dashboard.startDiagnostic")}
        </Link>
        {(!isAuthenticated || hasPaidAccess(plan)) && (
          <Link href="/scanner" className="font-body text-xs text-muted underline underline-offset-2 hover:text-copper-light">
            {t("dashboard.scanWithoutDiagnostic")}
          </Link>
        )}
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink-radial pb-28">
      <div className="mx-auto max-w-md px-6 pt-10">
        <div className="mb-8 flex items-center justify-between">
          <span className="font-display text-lg italic text-cream">Capil AI</span>
          <ThemeToggle />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleScanHairClick}
            className="glass flex w-full flex-col items-start gap-2 rounded-3xl p-4 text-left transition hover:border-copper/30"
          >
            <Camera size={18} className="text-copper-light" />
            <span className="font-body text-sm text-cream">{t("dashboard.scanHair")}</span>
          </button>
          <Link href="/scanner" className="glass flex flex-col items-start gap-2 rounded-3xl p-4 transition hover:border-copper/30">
            <ScanLine size={18} className="text-copper-light" />
            <span className="font-body text-sm text-cream">{t("dashboard.scanProduct")}</span>
          </Link>
          <Link href="/placard" className="glass flex flex-col items-start gap-2 rounded-3xl p-4 transition hover:border-copper/30">
            <PackagePlus size={18} className="text-copper-light" />
            <span className="font-body text-sm text-cream">{t("dashboard.virtualCloset")}</span>
          </Link>
          <Link href="/calendar" className="glass flex flex-col items-start gap-2 rounded-3xl p-4 transition hover:border-copper/30">
            <CalendarDays size={18} className="text-copper-light" />
            <span className="font-body text-sm text-cream">{t("dashboard.calendar")}</span>
          </Link>
          <Link href="/passport" className="glass flex flex-col items-start gap-2 rounded-3xl p-4 transition hover:border-copper/30">
            <ScrollText size={18} className="text-copper-light" />
            <span className="font-body text-sm text-cream">{t("dashboard.passport")}</span>
          </Link>
          <Link href="/historique" className="glass flex flex-col items-start gap-2 rounded-3xl p-4 transition hover:border-copper/30">
            <History size={18} className="text-copper-light" />
            <span className="font-body text-sm text-cream">{t("dashboard.historique")}</span>
          </Link>
        </div>

        <div className="glass mb-6 flex flex-col items-center rounded-4xl py-8">
          <StrandGauge score={profile.score} label={t("common.scoreLabel")} />
          <p className="mt-4 px-8 text-center font-body text-xs leading-relaxed text-muted">
            {profile.report.summary}
          </p>
          <Link
            href="/report"
            className="mt-6 flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-copper-gradient px-8 font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98]"
          >
            {t("dashboard.viewReport")}
          </Link>
        </div>

        <h2 className="mb-3 font-display text-lg text-cream">{t("dashboard.yourMetrics")}</h2>
        <div className="mb-8 grid grid-cols-2 gap-3">
          {Object.entries(profile.metrics).map(([key, value], i) => (
            <MetricCard
              key={key}
              label={metricLabels[key]?.label ?? key}
              value={value}
              hint={metricLabels[key]?.hint ?? ""}
              delay={i * 0.05}
            />
          ))}
        </div>

        <h2 className="mb-3 font-display text-lg text-cream">{t("dashboard.priorities")}</h2>
        <div className="mb-8 flex flex-wrap gap-2">
          {profile.priorities.map((p) => (
            <span key={p} className="rounded-full border border-copper/30 bg-copper/10 px-4 py-2 font-body text-xs text-copper-light">
              {p}
            </span>
          ))}
        </div>

        <h2 className="mb-3 font-display text-lg text-cream">{t("dashboard.dailyRoutine")}</h2>
        <div className="glass rounded-3xl p-5">
          <RoutineBlock title={t("dashboard.morning")} items={profile.routine.morning} />
          <RoutineBlock title={t("dashboard.evening")} items={profile.routine.evening} />
          <RoutineBlock title={t("dashboard.washDay")} items={profile.routine.washDay} last />
        </div>
      </div>
      <BottomNav />
    </main>
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
