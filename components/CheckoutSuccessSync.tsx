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
import { useTranslation } from "@/lib/useTranslation";

type CheckoutSuccessSyncProps = {
  redirectPath?: string;
  onSuccess?: () => void;
};

function activationErrorMessage(
  code: string | undefined,
  fallback: string,
  t: (key: string) => string
): string {
  switch (code) {
    case "AUTH_REQUIRED":
      return t("pricing.checkoutLoginRequired");
    case "USER_MISMATCH":
      return t("pricing.checkoutUserMismatch");
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
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const processedSessionRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const paymentVerifiedRef = useRef(false);
  const wasAuthenticatedRef = useRef(isAuthenticated);

  const loginHref = `/login?next=${encodeURIComponent(
    `${pathname}?${searchParams.toString()}`
  )}`;

  const runActivation = useCallback(
    async (sessionId: string, options?: { skipVerify?: boolean }) => {
      if (isAuthLoading) return;

      if (!isAuthenticated) {
        setSyncing(false);
        setCanRetry(false);
        setNeedsLogin(true);
        setNotice({ type: "error", message: t("pricing.checkoutLoginRequired") });
        return;
      }

      setSyncing(true);
      setCanRetry(false);
      setNeedsLogin(false);
      setNotice(null);

      if (!options?.skipVerify && !paymentVerifiedRef.current) {
        const verified = await verifyCheckoutSession(sessionId);
        if (!isCheckoutSessionVerified(verified)) {
          setSyncing(false);
          setCanRetry(true);
          setNotice({
            type: "error",
            message: verified.error ?? t("settings.checkoutVerifyError"),
          });
          return;
        }
        paymentVerifiedRef.current = true;
      }

      setNotice({ type: "success", message: t("pricing.checkoutActivating") });

      const result = await pollSubscriptionUntilActive(sessionId);
      setSyncing(false);

      if (result.activateError) {
        const needsAuth = result.activateError.code === "AUTH_REQUIRED";
        setNeedsLogin(needsAuth);
        setCanRetry(!needsAuth);
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
      if (hasServerActiveSubscription(payload)) {
        setServerSubscription(payload);
        mirrorServerPlanToLocal(payload);
        markReady();
        onSuccess?.();
        router.replace(redirectPath, { scroll: false });
        return;
      }

      setCanRetry(true);
      setNotice({
        type: "error",
        message: t("pricing.checkoutSyncFailed"),
      });
    },
    [
      isAuthLoading,
      isAuthenticated,
      markReady,
      onSuccess,
      redirectPath,
      router,
      setServerSubscription,
      t,
    ]
  );

  useEffect(() => {
    if (!wasAuthenticatedRef.current && isAuthenticated) {
      processedSessionRef.current = null;
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id")?.trim();
    if (checkout !== "success" || !sessionId) return;
    if (isAuthLoading) return;
    if (processedSessionRef.current === sessionId && !needsLogin) return;

    processedSessionRef.current = sessionId;
    sessionIdRef.current = sessionId;

    void runActivation(sessionId);
  }, [searchParams, isAuthLoading, isAuthenticated, runActivation, needsLogin]);

  function handleRetry() {
    const sessionId = sessionIdRef.current ?? searchParams.get("session_id")?.trim();
    if (!sessionId) return;
    processedSessionRef.current = null;
    void runActivation(sessionId, { skipVerify: paymentVerifiedRef.current });
  }

  if (!notice && !syncing && !needsLogin) return null;

  return (
    <div className="mx-auto mb-4 max-w-md">
      <p
        className={`rounded-2xl border p-3 text-center font-body text-xs ${
          notice?.type === "error"
            ? "border-copper/40 bg-copper/5 text-copper-light"
            : "border-copper/30 bg-copper/10 text-cream/90"
        }`}
      >
        {syncing && !notice ? t("pricing.checkoutActivating") : notice?.message}
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
