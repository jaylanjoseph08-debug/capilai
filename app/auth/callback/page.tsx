"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { isDiagnosisOnboardingPath, resolvePostLoginPath } from "@/lib/postAuthRedirect";
import { useTranslation } from "@/lib/useTranslation";

async function waitForSession(
  supabase: ReturnType<typeof getSupabase>,
  maxWaitMs = 5000
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    if (session) return session;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function resolveCallbackErrorMessage(
  t: (key: import("@/lib/i18n").TranslationKey) => string,
  errorCode: string | null,
  errorDescription: string | null
): string {
  if (errorDescription) return decodeURIComponent(errorDescription);
  if (errorCode === "access_denied") return t("auth.login.authFailed");
  return t("auth.login.authFailed");
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function CallbackFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-radial px-6">
      <p className="font-body text-sm text-muted">…</p>
    </main>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) router.replace("/login");
        return;
      }

      const supabase = getSupabase();
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const otpType = searchParams.get("type");
      const next = searchParams.get("next") || "/dashboard";
      const oauthError = searchParams.get("error");
      const oauthErrorDescription = searchParams.get("error_description");

      try {
        if (oauthError || oauthErrorDescription) {
          throw new Error(resolveCallbackErrorMessage(t, oauthError, oauthErrorDescription));
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            // OAuth providers can trigger duplicate callback calls. If session already exists, continue.
            const existing = await waitForSession(supabase, 1000);
            if (!existing) throw exchangeError;
          }
        } else if (tokenHash && otpType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change",
          });
          if (verifyError) throw verifyError;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 150));
          const { error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
        }

        const session = await waitForSession(supabase, 5000);

        if (!session) {
          throw new Error("No session after auth callback");
        }

        if (isDiagnosisOnboardingPath(next)) {
          if (!cancelled) router.replace(next);
          return;
        }

        const path = await resolvePostLoginPath(next);
        if (!cancelled) router.replace(path);
      } catch (err) {
        if (cancelled) return;
        console.error("[auth/callback] OAuth completion failed", err);
        setError(err instanceof Error ? err.message : t("auth.login.authFailed"));
        setTimeout(() => router.replace("/login"), 2500);
      }
    }

    finishAuth();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams, t]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-radial px-6 text-center">
      <p className="font-body text-sm text-muted">
        {error || t("auth.callback.signingIn")}
      </p>
      {error && (
        <p className="mt-2 font-body text-xs text-copper-light">{t("auth.callback.redirecting")}</p>
      )}
    </main>
  );
}
