"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StrandGauge } from "@/components/ui/StrandGauge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { resolveDiagnosisEntryPath, resolveProfileEntryPath } from "@/lib/postAuthRedirect";
import { useTranslation } from "@/lib/useTranslation";

export default function LandingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [profileLoading, setProfileLoading] = useState(false);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  async function handleProfileClick() {
    setProfileLoading(true);
    try {
      const path = await resolveProfileEntryPath();
      router.push(path);
    } finally {
      setProfileLoading(false);
    }
  }

  function handleStartDiagnosis() {
    setDiagnosisLoading(true);
    router.push(resolveDiagnosisEntryPath());
    setDiagnosisLoading(false);
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-ink-radial">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-10">
        <div className="mb-16 flex items-center justify-between">
          <span className="font-display text-lg italic tracking-tight text-cream">Capil AI</span>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted sm:inline">
              {t("home.badge")}
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="mb-10 flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-8">
            <StrandGauge score={82} size={200} label={t("common.scoreLabel")} />
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.1] text-cream">
            {t("home.titlePrefix")}
            <span className="italic text-copper-light">{t("home.titleHair")}</span>
            {t("home.titleRest")}
          </h1>
          <p className="mt-5 font-body text-sm leading-relaxed text-muted">{t("home.subtitle")}</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleStartDiagnosis}
            disabled={diagnosisLoading}
            className="flex h-14 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98] disabled:opacity-60"
          >
            {diagnosisLoading ? "…" : t("home.ctaStart")}
          </button>
          <Link
            href="/login"
            className="flex h-14 items-center justify-center rounded-full border border-line font-body text-sm text-cream/80 transition hover:border-copper/50"
          >
            {t("home.ctaLogin")}
          </Link>
          <button
            type="button"
            onClick={handleProfileClick}
            disabled={profileLoading}
            className="flex h-12 items-center justify-center font-body text-sm text-copper-light transition hover:text-copper disabled:opacity-60"
          >
            {profileLoading ? "…" : t("home.ctaProfile")}
          </button>
          <Link
            href="/private-access"
            className="flex h-12 items-center justify-center font-mono text-[10px] uppercase tracking-widest text-muted transition hover:text-copper"
          >
            {t("home.ctaPrivateAccess")}
          </Link>
        </div>
      </div>
    </main>
  );
}
