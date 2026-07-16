"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { DIAGNOSIS_ONBOARDING_PATH } from "@/lib/postAuthRedirect";
import { resolveAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { OAuthButton } from "@/components/ui/BrandMarks";
import { useTranslation } from "@/lib/useTranslation";

const DEFAULT_POST_SIGNUP_PATH = "/pricing";

function resolveAuthError(t: (key: import("@/lib/i18n").TranslationKey) => string, code: string) {
  if (code === "already_registered") return t("auth.signup.alreadyRegistered");
  if (/rate limit/i.test(code)) return t("auth.signup.emailRateLimit");
  if (/error sending confirmation email/i.test(code)) return t("auth.signup.emailSendFailed");
  return resolveAuthErrorMessage(t, code, "auth.signup.authFailed");
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  );
}

function SignupFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-radial px-6">
      <p className="font-body text-sm text-muted">…</p>
    </main>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const signUp = useAuthStore((s) => s.signUp);
  const resendSignupConfirmation = useAuthStore((s) => s.resendSignupConfirmation);
  const isConfigured = useAuthStore((s) => s.isConfigured);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resending, setResending] = useState(false);

  const fromDiagnosis = searchParams.get("from") === "diagnosis";
  const postSignupPath = fromDiagnosis ? DIAGNOSIS_ONBOARDING_PATH : DEFAULT_POST_SIGNUP_PATH;
  const loginHref = fromDiagnosis
    ? `/login?next=${encodeURIComponent(DIAGNOSIS_ONBOARDING_PATH)}`
    : "/login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("auth.signup.nameRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("auth.signup.invalidEmail"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.signup.passwordShort"));
      return;
    }
    if (!isConfigured) {
      setError(t("auth.signup.notConfigured"));
      return;
    }

    setError("");
    setSubmitting(true);
    const result = await signUp(name.trim(), email, password, postSignupPath);
    setSubmitting(false);

    if (result.error) {
      setError(resolveAuthError(t, result.error));
      return;
    }

    if (result.needsEmailConfirmation) {
      if (result.emailSent === false) {
        setError(t("auth.signup.emailSendFailed"));
        return;
      }
      setAwaitingEmailConfirmation(true);
      return;
    }

    router.push(postSignupPath);
  }

  async function handleResendEmail() {
    if (!email) return;
    setResending(true);
    setResendMessage("");
    setError("");
    const result = await resendSignupConfirmation(email, postSignupPath);
    setResending(false);
    if (result.error) {
      setError(resolveAuthError(t, result.error));
      return;
    }
    setResendMessage(t("auth.signup.resendEmailDone"));
  }

  if (awaitingEmailConfirmation) {
    return (
      <main className="flex min-h-screen flex-col bg-ink-radial px-6 pb-10 pt-8">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center text-center">
          <h1 className="font-display text-3xl font-medium text-cream">{t("auth.signup.confirmEmailTitle")}</h1>
          <p className="mt-4 font-body text-sm leading-relaxed text-muted">
            {t("auth.signup.confirmEmailBody")}{" "}
            <span className="font-medium text-cream">{email}</span>.
            <br />
            {t("auth.signup.confirmEmailHint")}
          </p>
          {error && <p className="mt-4 font-body text-xs text-copper-light">{error}</p>}
          {resendMessage && <p className="mt-4 font-body text-xs text-copper-light">{resendMessage}</p>}
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resending}
            className="mt-6 flex h-12 items-center justify-center rounded-full border border-line font-body text-sm text-cream transition hover:border-copper/50 disabled:opacity-60"
          >
            {resending ? "…" : t("auth.signup.resendEmail")}
          </button>
          <Link
            href={loginHref}
            className="mt-4 flex h-14 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98]"
          >
            {t("auth.signup.confirmEmailCta")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink-radial px-6 pb-10 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Link
          href={fromDiagnosis ? "/" : "/"}
          className="mb-10 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper"
        >
          ← {t("auth.signup.back")}
        </Link>

        <h1 className="font-display text-3xl font-medium text-cream">{t("auth.signup.title")}</h1>
        <p className="mt-2 mb-8 font-body text-sm text-muted">
          {fromDiagnosis ? t("auth.signup.subtitleDiagnosis") : t("auth.signup.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.signup.firstName")}
            autoComplete="given-name"
            className="h-14 rounded-2xl border border-line bg-surface px-5 font-body text-sm text-cream placeholder:text-muted focus:border-copper/60 focus:outline-none"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.signup.email")}
            autoComplete="email"
            className="h-14 rounded-2xl border border-line bg-surface px-5 font-body text-sm text-cream placeholder:text-muted focus:border-copper/60 focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.signup.password")}
            autoComplete="new-password"
            className="h-14 rounded-2xl border border-line bg-surface px-5 font-body text-sm text-cream placeholder:text-muted focus:border-copper/60 focus:outline-none"
          />
          {error && <p className="font-body text-xs text-copper-light">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex h-14 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "…" : t("auth.signup.submit")}
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
            label={t("auth.signup.continueGoogle")}
            nextPath={postSignupPath}
            onError={(code) => setError(resolveAuthError(t, code))}
          />
        </div>

        <p className="mt-8 text-center font-body text-sm text-muted">
          {t("auth.signup.hasAccount")}{" "}
          <Link href={loginHref} className="text-copper-light underline underline-offset-2">
            {t("auth.signup.signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
