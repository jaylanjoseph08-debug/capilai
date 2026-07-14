"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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
  const processedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id")?.trim();
    if (checkout !== "success" || !sessionId) return;
    if (processedSessionRef.current === sessionId) return;
    processedSessionRef.current = sessionId;

    let cancelled = false;

    async function activateSubscription() {
      setSyncing(true);
      setNotice(null);

      const verified = await verifyCheckoutSession(sessionId!);
      if (cancelled) return;

      if (!isCheckoutSessionVerified(verified)) {
        setSyncing(false);
        setNotice({
          type: "error",
          message: verified.error ?? t("settings.checkoutVerifyError"),
        });
        return;
      }

      setNotice({ type: "success", message: t("pricing.checkoutActivating") });

      const payload = await pollSubscriptionUntilActive();
      if (cancelled) return;

      setSyncing(false);

      if (hasServerActiveSubscription(payload)) {
        setServerSubscription(payload);
        mirrorServerPlanToLocal(payload);
        markReady();
        onSuccess?.();
        router.replace(redirectPath, { scroll: false });
        return;
      }

      setNotice({
        type: "error",
        message: t("pricing.checkoutSyncFailed"),
      });
    }

    void activateSubscription();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setServerSubscription, markReady, onSuccess, router, redirectPath, t]);

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
