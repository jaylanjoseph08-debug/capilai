"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  hasPrivateAccess,
  isPrivateAccessConfigured,
  lockPrivateAccess,
  unlockPrivateAccess,
} from "@/lib/privateAccess";
import { useTranslation } from "@/lib/useTranslation";

export default function PrivateAccessPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-ink-radial" />}>
      <PrivateAccessContent />
    </Suspense>
  );
}

function PrivateAccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const configured = isPrivateAccessConfigured();

  useEffect(() => {
    setUnlocked(hasPrivateAccess());
  }, []);

  useEffect(() => {
    const paramCode = searchParams.get("code")?.trim();
    if (!paramCode || !configured) return;
    if (unlockPrivateAccess(paramCode)) {
      setUnlocked(true);
      setError("");
      router.replace("/dashboard");
    }
  }, [searchParams, configured, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!configured) {
      setError(t("privateAccess.notConfigured"));
      return;
    }
    if (unlockPrivateAccess(code)) {
      setUnlocked(true);
      router.push("/dashboard");
      return;
    }
    setError(t("privateAccess.invalidCode"));
  }

  function handleLock() {
    lockPrivateAccess();
    setUnlocked(false);
    setCode("");
  }

  if (!configured) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-ink-radial px-6 text-center">
        <p className="font-body text-sm text-muted">{t("privateAccess.notConfigured")}</p>
        <Link href="/" className="mt-6 font-mono text-[10px] uppercase tracking-widest text-copper">
          ← {t("privateAccess.back")}
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink-radial px-6 pb-10 pt-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="mb-10 inline-block font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper"
        >
          ← {t("privateAccess.back")}
        </Link>

        <h1 className="font-display text-3xl font-medium text-cream">{t("privateAccess.title")}</h1>
        <p className="mt-2 font-body text-sm text-muted">{t("privateAccess.subtitle")}</p>

        {unlocked ? (
          <div className="mt-8 rounded-3xl border border-copper/30 bg-copper/10 p-5 text-center">
            <p className="font-body text-sm text-cream/90">{t("privateAccess.active")}</p>
            <Link
              href="/dashboard"
              className="mt-4 flex h-12 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink"
            >
              {t("privateAccess.openApp")}
            </Link>
            <button
              type="button"
              onClick={handleLock}
              className="mt-3 font-body text-xs text-copper-light underline-offset-2 hover:underline"
            >
              {t("privateAccess.deactivate")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("privateAccess.placeholder")}
              className="h-12 rounded-2xl border border-line bg-surface px-4 font-mono text-sm text-cream placeholder:text-muted focus:border-copper/60 focus:outline-none"
              autoComplete="off"
            />
            <button
              type="submit"
              className="flex h-12 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow"
            >
              {t("privateAccess.submit")}
            </button>
            {error && <p className="text-center font-body text-xs text-copper-light">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
