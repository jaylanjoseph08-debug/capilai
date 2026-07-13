"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSubscriptionStore } from "@/lib/subscriptionStore";
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
  const setPlan = useSubscriptionStore((s) => s.setPlan);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const processedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id")?.trim();
    if (checkout !== "success" || !sessionId) return;
    if (processedSessionRef.current === sessionId) return;
    processedSessionRef.current = sessionId;

    let cancelled = false;

    async function activateSubscription() {
      const result = await verifyCheckoutSession(sessionId!);
      if (cancelled) return;

      if (isCheckoutSessionVerified(result)) {
        setPlan(result.plan, result.billingCycle, { checkout: true });
        onSuccess?.();
        router.replace(redirectPath, { scroll: false });
        return;
      }

      setNotice({
        type: "error",
        message: result.error ?? t("settings.checkoutVerifyError"),
      });
    }

    void activateSubscription();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setPlan, onSuccess, router, redirectPath, t]);

  if (!notice) return null;

  return (
    <div className="mx-auto mb-4 max-w-md">
      <p
        className={`rounded-2xl border p-3 text-center font-body text-xs ${
          notice.type === "success"
            ? "border-copper/30 bg-copper/10 text-cream/90"
            : "border-copper/40 bg-copper/5 text-copper-light"
        }`}
      >
        {notice.message}
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
