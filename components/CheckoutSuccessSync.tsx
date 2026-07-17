"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hasServerActiveSubscription } from "@/lib/subscriptionAccess";
import { useAuthStore } from "@/lib/authStore";
import {
  mirrorServerPlanToLocal,
  pollSubscriptionUntilActive,
} from "@/lib/subscriptionSync";
import { useSubscriptionSyncStore } from "@/lib/subscriptionSyncStore";
import { verifyCheckoutSession, isCheckoutSessionVerified } from "@/lib/stripe";
import { savePendingCheckoutSessionId } from "@/lib/pendingCheckoutSession";
import { useTranslation } from "@/lib/useTranslation";
import type { TranslationKey } from "@/lib/i18n";

type CheckoutSuccessSyncProps = {
  redirectPath?: string;
  onSuccess?: () => void;
};

function activationErrorMessage(
  code: string | undefined,
  fallback: string,
  t: (key: TranslationKey) => string
): string {
  switch (code) {
    case "AUTH_REQUIRED":
      return t("pricing.checkoutLoginRequired");
    case "USER_MISMATCH":
      return t("pricing.checkoutUserMismatch");
    case "SUBSCRIPTIONS_TABLE_MISSING":
    case "UPSERT_FAILED":
      return t("pricing.checkoutDbError");
    case "STRIPE_MODE_MISMATCH":
    case "STRIPE_ERROR":
      return t("pricing.checkoutStripeConfigError");
    default:
      return fallback;
  }
}

function CheckoutSuccessSyncInner({ redirectPath = "/dashboard", onSuccess }: CheckoutSuccessSyncProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setServerSubscription = useSubscriptionSyncStore((s) => s.setServerSubscription);
  const markReady = useSubscriptionSyncStore((s) => s.markReady);
  const checkout = searchParams.get("checkout");
  const sessionIdFromUrl = searchParams.get("session_id")?.trim() ?? null;
  const isCheckoutSuccess = checkout === "success" && Boolean(sessionIdFromUrl);

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    isCheckoutSuccess ? { type: "success", message: t("pricing.checkoutActivating") } : null
  );
  const [syncing, setSyncing] = useState(isCheckoutSuccess);
  const [canRetry, setCanRetry] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const processedSessionRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(sessionIdFromUrl);
  const paymentVerifiedRef = useRef(false);
  const wasAuthenticatedRef = useRef(isAuthenticated);
  const inFlightRef = useRef(false);

  const loginHref = `/login?next=${encodeURIComponent(
    `${pathname}?${searchParams.toString()}`
  )}`;

  const finishSuccess = useCallback(
    (payload: NonNullable<Awaited<ReturnType<typeof pollSubscriptionUntilActive>>["payload"]>) => {
      setServerSubscription(payload);
      mirrorServerPlanToLocal(payload);
      markReady();
      onSuccess?.();
      // Always strip checkout query params so the dashboard exits the "activating" shell.
      router.replace(redirectPath, { scroll: false });
    },
    [markReady, onSuccess, redirectPath, router, setServerSubscription]
  );

  const runActivation = useCallback(
    async (sessionId: string, options?: { skipVerify?: boolean }) => {
      if (inFlightRef.current) return;
      if (isAuthLoading) {
        setSyncing(true);
        setNotice({ type: "success", message: t("pricing.checkoutActivating") });
        return;
      }

      if (!isAuthenticated) {
        setSyncing(false);
        setCanRetry(false);
        setNeedsLogin(true);
        setNotice({ type: "error", message: t("pricing.checkoutLoginRequired") });
        return;
      }

      inFlightRef.current = true;
      setSyncing(true);
      setCanRetry(false);
      setNeedsLogin(false);
      setNotice({ type: "success", message: t("pricing.checkoutActivating") });

      try {
        if (!options?.skipVerify && !paymentVerifiedRef.current) {
          const verified = await verifyCheckoutSession(sessionId);
          if (!isCheckoutSessionVerified(verified)) {
            setSyncing(false);
            setCanRetry(true);
            setNotice({
              type: "error",
              message: activationErrorMessage(
                "code" in verified ? verified.code : undefined,
                verified.error ?? t("settings.checkoutVerifyError"),
                t
              ),
            });
            return;
          }
          paymentVerifiedRef.current = true;
        }

        const result = await pollSubscriptionUntilActive(sessionId);

        if (result.activateError) {
          const needsAuth = result.activateError.code === "AUTH_REQUIRED";
          setNeedsLogin(needsAuth);
          setCanRetry(!needsAuth);
          setSyncing(false);
          setNotice({
            type: "error",
            message: activationErrorMessage(
              result.activateError.code,
              result.activateError.error || t("pricing.checkoutSyncFailed"),
              t
            ),
          });
          return;
        }

        const payload = result.payload;
        if (payload && hasServerActiveSubscription(payload)) {
          setSyncing(false);
          finishSuccess(payload);
          return;
        }

        setSyncing(false);
        setCanRetry(true);
        setNotice({
          type: "error",
          message: t("pricing.checkoutSyncFailed"),
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [finishSuccess, isAuthLoading, isAuthenticated, t]
  );

  useEffect(() => {
    if (!wasAuthenticatedRef.current && isAuthenticated) {
      processedSessionRef.current = null;
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isCheckoutSuccess || !sessionIdFromUrl) return;
    if (isAuthLoading) {
      setSyncing(true);
      return;
    }
    if (processedSessionRef.current === sessionIdFromUrl && !needsLogin) return;

    processedSessionRef.current = sessionIdFromUrl;
    sessionIdRef.current = sessionIdFromUrl;
    savePendingCheckoutSessionId(sessionIdFromUrl);

    void runActivation(sessionIdFromUrl);
  }, [isCheckoutSuccess, sessionIdFromUrl, isAuthLoading, isAuthenticated, runActivation, needsLogin]);

  function handleRetry() {
    const sessionId = sessionIdRef.current ?? sessionIdFromUrl;
    if (!sessionId) return;
    processedSessionRef.current = null;
    void runActivation(sessionId, { skipVerify: paymentVerifiedRef.current });
  }

  if (!isCheckoutSuccess && !notice && !syncing && !needsLogin) return null;

  return (
    <div className="mx-auto mb-4 max-w-md">
      <p
        className={`rounded-2xl border p-3 text-center font-body text-xs ${
          notice?.type === "error"
            ? "border-copper/40 bg-copper/5 text-copper-light"
            : "border-copper/30 bg-copper/10 text-cream/90"
        }`}
      >
        {notice?.message ?? t("pricing.checkoutActivating")}
      </p>
      {needsLogin && !syncing && (
        <Link
          href={loginHref}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98]"
        >
          {t("pricing.checkoutLoginButton")}
        </Link>
      )}
      {canRetry && !syncing && !needsLogin && (
        <button
          type="button"
          onClick={handleRetry}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98]"
        >
          {t("pricing.checkoutRetryActivation")}
        </button>
      )}
    </div>
  );
}

export function CheckoutSuccessSync(props: CheckoutSuccessSyncProps) {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessSyncInner {...props} />
    </Suspense>
  );
}
