"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { isDiagnosisOnboardingPath, resolvePostLoginPath } from "@/lib/postAuthRedirect";
import { OAuthButton } from "@/components/ui/BrandMarks";
import { useTranslation } from "@/lib/useTranslation";

function resolveAuthError(t: (key: import("@/lib/i18n").TranslationKey) => string, code: string) {
  if (code === "not_configured") return t("auth.login.notConfigured");
  return code || t("auth.login.authFailed");
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-radial px-6">
      <p className="font-body text-sm text-muted">…</p>
    </main>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);
  const isConfigured = useAuthStore((s) => s.isConfigured);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams.get("next") || "/dashboard";

  async function resolveDestination(): Promise<string> {
    if (isDiagnosisOnboardingPath(nextPath)) return nextPath;
    return resolvePostLoginPath(nextPath);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("auth.login.invalidEmail"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.login.passwordShort"));
      return;
    }
    if (!isConfigured) {
      setError(t("auth.login.notConfigured"));
      return;
    }

    setError("");
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (result.error) {
      setError(resolveAuthError(t, result.error));
      return;
    }
    const path = await resolveDestination();
    router.push(path);
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink-radial px-6 pb-10 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Link href="/" className="mb-10 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
          ← {t("auth.login.back")}
        </Link>

        <h1 className="font-display text-3xl font-medium text-cream">{t("auth.login.title")}</h1>
        <p className="mt-2 mb-8 font-body text-sm text-muted">{t("auth.login.subtitle")}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.login.email")}
            autoComplete="email"
            className="h-14 rounded-2xl border border-line bg-surface px-5 font-body text-sm text-cream placeholder:text-muted focus:border-copper/60 focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.login.password")}
            autoComplete="current-password"
            className="h-14 rounded-2xl border border-line bg-surface px-5 font-body text-sm text-cream placeholder:text-muted focus:border-copper/60 focus:outline-none"
          />
          {error && <p className="font-body text-xs text-copper-light">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex h-14 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "…" : t("auth.login.submit")}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{t("common.or")}</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-3">
          <OAuthButton
            provider="google"
            label={t("auth.login.continueGoogle")}
            nextPath={nextPath}
            onError={(code) => setError(resolveAuthError(t, code))}
          />
        </div>

        <p className="mt-8 text-center font-body text-sm text-muted">
          {t("auth.login.noAccount")}{" "}
          <Link
            href={
              isDiagnosisOnboardingPath(nextPath)
                ? "/signup?from=diagnosis"
                : "/signup"
            }
            className="text-copper-light underline underline-offset-2"
          >
            {t("auth.login.createAccount")}
          </Link>
        </p>
      </div>
    </main>
  );
}
