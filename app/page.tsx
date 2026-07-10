"use client";

import Link from "next/link";
import { StrandGauge } from "@/components/ui/StrandGauge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useTranslation } from "@/lib/useTranslation";

export default function LandingPage() {
  const { t } = useTranslation();

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
          <Link
            href="/onboarding"
            className="flex h-14 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98]"
          >
            {t("home.ctaStart")}
          </Link>
          <Link
            href="/login"
            className="flex h-14 items-center justify-center rounded-full border border-line font-body text-sm text-cream/80 transition hover:border-copper/50"
          >
            {t("home.ctaLogin")}
          </Link>
          <Link
            href="/dashboard"
            className="flex h-12 items-center justify-center font-body text-sm text-copper-light transition hover:text-copper"
          >
            {t("home.ctaProfile")}
          </Link>
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
