"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { OAuthButton } from "@/components/ui/BrandMarks";
import { useTranslation } from "@/lib/useTranslation";

const POST_SIGNUP_PATH = "/pricing";

function resolveAuthError(t: (key: import("@/lib/i18n").TranslationKey) => string, code: string) {
  if (code === "not_configured") return t("auth.signup.notConfigured");
  return code || t("auth.signup.authFailed");
}

export default function SignupPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const signUp = useAuthStore((s) => s.signUp);
  const isConfigured = useAuthStore((s) => s.isConfigured);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    const result = await signUp(name.trim(), email, password);
    setSubmitting(false);

    if (result.error) {
      setError(resolveAuthError(t, result.error));
      return;
    }
    router.push(POST_SIGNUP_PATH);
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink-radial px-6 pb-10 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Link href="/" className="mb-10 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
          ← {t("auth.signup.back")}
        </Link>

        <h1 className="font-display text-3xl font-medium text-cream">{t("auth.signup.title")}</h1>
        <p className="mt-2 mb-8 font-body text-sm text-muted">{t("auth.signup.subtitle")}</p>

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
            nextPath={POST_SIGNUP_PATH}
            onError={(code) => setError(resolveAuthError(t, code))}
          />
        </div>

        <p className="mt-8 text-center font-body text-sm text-muted">
          {t("auth.signup.hasAccount")}{" "}
          <Link href="/login" className="text-copper-light underline underline-offset-2">
            {t("auth.signup.signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
