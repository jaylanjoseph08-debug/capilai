"use client";

import { useState } from "react";
import { startCheckout, isCheckoutSuccess } from "@/lib/stripe";
import type { Plan, BillingCycle } from "@/lib/subscriptionStore";

export type PaymentButtonProps = {
  plan: Plan;
  billingCycle?: BillingCycle;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Called when Stripe is not configured (demo / local fallback). */
  onDemoFallback?: (plan: Plan, billingCycle: BillingCycle) => void;
  onError?: (message: string) => void;
};

const DEFAULT_CLASS =
  "flex h-12 w-full items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

export function PaymentButton({
  plan,
  billingCycle = "annual",
  children,
  className,
  disabled = false,
  onDemoFallback,
  onError,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (disabled || loading) return;

    setLoading(true);
    const result = await startCheckout(plan, billingCycle);
    setLoading(false);

    if (isCheckoutSuccess(result)) {
      window.location.href = result.url;
      return;
    }

    if (!result.configured) {
      onDemoFallback?.(plan, billingCycle);
      return;
    }

    onError?.(result.error ?? "Unable to start checkout");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={className ?? DEFAULT_CLASS}
    >
      {loading ? "Redirection…" : children ?? "Payer avec Stripe"}
    </button>
  );
}
