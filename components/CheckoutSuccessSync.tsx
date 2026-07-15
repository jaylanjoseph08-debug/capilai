"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { hasServerActiveSubscription } from "@/lib/subscriptionAccess";
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

function CheckoutSuccessSyncInner({ redirectPath = "/dashboard", onSuccess }: CheckoutSuccessSyncProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const setServerSubscription = useSubscriptionSyncStore((s) => s.setServerSubscription);
  const markReady = useSubscriptionSyncStore((s) => s.markReady);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const processedSessionRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const paymentVerifiedRef = useRef(false);

  const runActivation = useCallback(
    async (sessionId: string, options?: { skipVerify?: boolean }) => {
      setSyncing(true);
      setCanRetry(false);
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

      const payload = await pollSubscriptionUntilActive();
      setSyncing(false);

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
    [markReady, onSuccess, redirectPath, router, setServerSubscription, t]
  );

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id")?.trim();
    if (checkout !== "success" || !sessionId) return;
    if (processedSessionRef.current === sessionId) return;
    processedSessionRef.current = sessionId;
    sessionIdRef.current = sessionId;
    paymentVerifiedRef.current = false;

    void runActivation(sessionId);
  }, [searchParams, runActivation]);

  function handleRetry() {
    const sessionId = sessionIdRef.current ?? searchParams.get("session_id")?.trim();
    if (!sessionId) return;
    void runActivation(sessionId, { skipVerify: paymentVerifiedRef.current });
  }

  if (!notice && !syncing) return null;

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
      {canRetry && !syncing && (
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
