"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useSubscriptionStore, type Plan, type BillingCycle } from "@/lib/subscriptionStore";
import { PLAN_PRICES, getPlanFeatures, annualSavingsPercent, formatPrice, isLifetimePrice, lifetimeFeatureLabel } from "@/lib/pricing";
import { startCheckout, isCheckoutSuccess } from "@/lib/stripe";
import { useTranslation } from "@/lib/useTranslation";
import { CheckoutSuccessSync } from "@/components/CheckoutSuccessSync";

const MAX_ANNUAL_SAVINGS = Math.max(...(["free", "premium", "pro"] as Plan[]).map(annualSavingsPercent));

export default function PricingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-ink-radial" />}>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t, planLabel } = useTranslation();
  const fromDiagnostic = searchParams.get("from") === "diagnostic";
  const fromLimit = searchParams.get("from") === "limit";
  const upgradeParam = searchParams.get("upgrade");
  const highlightPlan: Plan | null =
    upgradeParam === "premium" || upgradeParam === "pro" ? upgradeParam : null;
  const { plan: currentPlan, hasSelectedPlan, setPlan } = useSubscriptionStore();
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const [coupon, setCoupon] = useState("");
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [notice, setNotice] = useState("");

  const discount = coupon.trim().toUpperCase() === "MECHE10" ? 0.1 : 0;

  async function handleChoose(plan: Plan) {
    setLoadingPlan(plan);
    setNotice("");
    const result = await startCheckout(plan, cycle);
    setLoadingPlan(null);

    if (isCheckoutSuccess(result)) {
      window.location.href = result.url;
      return;
    }

    if (!result.configured) {
      setPlan(plan, cycle);
      setNotice(t("pricing.demoMode"));
      setTimeout(() => router.push("/settings?checkout=success"), 1200);
      return;
    }

    setNotice(result.error ?? t("pricing.stripeError"));
  }

  return (
    <main className="relative min-h-screen bg-ink-radial px-6 pb-16 pt-10">
      <CheckoutSuccessSync />
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-center">
          {!fromDiagnostic && (
            <Link
              href="/settings"
              className="absolute left-6 font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper"
            >
              ← {t("pricing.backAccount")}
            </Link>
          )}
          <span className="font-display text-lg italic text-cream">{t("pricing.title")}</span>
        </div>

        {fromLimit && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-copper/40 bg-copper/15 p-4 text-center font-body text-sm text-cream/90"
          >
            {t("pricing.limitReached")}
          </motion.p>
        )}

        {fromDiagnostic && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-copper/30 bg-copper/10 p-4 text-center font-body text-sm text-cream/90"
          >
            {t("pricing.diagnosticReady")}
          </motion.p>
        )}

        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            <span className="rounded-full bg-copper-gradient px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-ink">
              {t("pricing.mostPopular")}
            </span>
            <span className="rounded-full border border-copper/40 bg-copper/10 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-copper-light">
              {t("pricing.saveUpTo").replace("{n}", String(MAX_ANNUAL_SAVINGS))}
            </span>
          </div>

          <div className="flex w-full max-w-xs items-center justify-between rounded-full border border-line bg-surface/50 p-1">
            <button
              onClick={() => setCycle("monthly")}
              className={`flex-1 rounded-full py-2.5 font-body text-xs transition ${
                cycle === "monthly" ? "bg-surface2 text-cream font-medium" : "text-muted"
              }`}
            >
              {t("pricing.monthly")}
            </button>
            <button
              onClick={() => setCycle("annual")}
              aria-pressed={cycle === "annual"}
              className={`relative flex-1 rounded-full py-2.5 font-body text-xs transition ${
                cycle === "annual" ? "bg-copper-gradient font-semibold text-ink shadow-glow" : "text-muted"
              }`}
            >
              {t("pricing.annual")}
              {cycle === "annual" && (
                <motion.span
                  layoutId="annual-badge"
                  className="absolute -right-1 -top-2 rounded-full bg-gold px-1.5 py-0.5 font-mono text-[7px] uppercase text-ink"
                >
                  -{MAX_ANNUAL_SAVINGS}%
                </motion.span>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {(["free", "premium", "pro"] as Plan[]).map((plan) => (
            <PlanCard
              key={plan}
              plan={plan}
              cycle={cycle}
              discount={discount}
              isCurrent={hasSelectedPlan && currentPlan === plan}
              isHighlighted={highlightPlan === plan}
              loading={loadingPlan === plan}
              onChoose={() => handleChoose(plan)}
              label={planLabel(plan)}
              features={getPlanFeatures(locale, plan).filter(
                (f) => f !== lifetimeFeatureLabel(locale) || cycle === "annual"
              )}
              t={t}
              locale={locale}
            />
          ))}
        </div>

        {notice && (
          <p className="mt-4 rounded-2xl border border-copper/30 bg-copper/10 p-3 text-center font-body text-xs text-cream/80">
            {notice}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <input
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            placeholder={t("pricing.promoCode")}
            className="h-12 flex-1 rounded-2xl border border-line bg-surface px-4 font-mono text-sm uppercase text-cream placeholder:text-muted placeholder:normal-case focus:border-copper/60 focus:outline-none"
          />
        </div>
        {discount > 0 && (
          <p className="mt-2 font-body text-xs text-copper-light">{t("pricing.promoApplied")}</p>
        )}
      </div>
    </main>
  );
}

function PlanCard({
  plan,
  cycle,
  discount,
  isCurrent,
  isHighlighted,
  loading,
  onChoose,
  label,
  features,
  t,
  locale,
}: {
  plan: Plan;
  cycle: BillingCycle;
  discount: number;
  isCurrent: boolean;
  isHighlighted?: boolean;
  loading: boolean;
  onChoose: () => void;
  label: string;
  features: string[];
  t: (key: import("@/lib/i18n").TranslationKey) => string;
  locale: import("@/lib/locale").Locale;
}) {
  const basePrice = PLAN_PRICES[plan][cycle];
  const price = Math.round(basePrice * (1 - discount) * 100) / 100;
  const savings = annualSavingsPercent(plan);
  const monthlyFromAnnual = Math.round((PLAN_PRICES[plan].annual / 12) * (1 - discount) * 100) / 100;
  const monthlyList = Math.round(PLAN_PRICES[plan].monthly * (1 - discount) * 100) / 100;
  const isPopular = plan === "premium";
  const lifetime = isLifetimePrice(plan, cycle);
  const isAnnual = cycle === "annual";
  const emphasized = isHighlighted || isPopular;

  return (
    <motion.div
      layout
      className={`relative rounded-4xl p-6 ${
        isHighlighted
          ? "border-2 border-copper bg-copper/10 shadow-glow ring-2 ring-copper/30"
          : isPopular
            ? "border-2 border-copper/60 bg-copper/5 shadow-glow"
            : "glass"
      }`}
    >
      {isHighlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-copper-gradient px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-ink">
          {t("pricing.mostPopular")}
        </span>
      )}
      {!isHighlighted && isPopular && (
        <span className="absolute -top-3 left-6 rounded-full bg-copper-gradient px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-ink">
          {t("pricing.mostPopular")}
        </span>
      )}

      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="font-display text-xl text-cream">{label}</span>
        <div className="text-right">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${plan}-${cycle}-${price}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {isAnnual ? (
                <>
                  <span className="font-display text-2xl text-cream">
                    {formatPrice(lifetime ? monthlyList : monthlyFromAnnual)}
                    <span className="font-body text-xs text-muted">{t("pricing.perMonth")}</span>
                  </span>
                  <p className="mt-1 font-body text-[11px] text-muted">
                    {formatPrice(price)}
                    {lifetime ? t("pricing.lifetime") : t("pricing.perYear")}
                    {!lifetime && (
                      <span className="text-copper-light">
                        {" "}
                        · {t("pricing.saveUpTo").replace("{n}", String(savings))}
                      </span>
                    )}
                  </p>
                  {lifetime && (
                    <p className="mt-0.5 font-body text-[10px] text-copper-light">{t("pricing.oneTimeLifetime")}</p>
                  )}
                </>
              ) : (
                <>
                  <span className="font-display text-2xl text-cream">
                    {formatPrice(price)}
                    <span className="font-body text-xs text-muted">{t("pricing.perMonth")}</span>
                  </span>
                  <p className="mt-1 font-body text-[11px] text-muted">
                    {locale === "fr" ? "ou" : "or"} {formatPrice(PLAN_PRICES[plan].annual)}
                    {plan === "pro" ? t("pricing.lifetime") : t("pricing.perYear")}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {cycle === "annual" && !lifetime && (
        <div className="mb-4 rounded-2xl border border-copper/25 bg-copper/10 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-copper-light">
            {t("pricing.savePerYear").replace(
              "{amount}",
              formatPrice(PLAN_PRICES[plan].monthly * 12 - PLAN_PRICES[plan].annual)
            )}
          </p>
        </div>
      )}

      <ul className="mb-5 flex flex-col gap-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 font-body text-xs text-cream/80">
            <Check size={14} className="mt-0.5 flex-shrink-0 text-copper-light" />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={onChoose}
        disabled={isCurrent || loading}
        className={`flex h-12 w-full items-center justify-center rounded-full font-body text-sm font-semibold transition active:scale-[0.98] disabled:active:scale-100 ${
          emphasized
            ? "bg-copper-gradient text-ink shadow-glow"
            : "border border-line text-cream hover:border-copper/50"
        } ${isCurrent ? "opacity-60" : ""}`}
      >
        {isCurrent
          ? t("pricing.currentPlan")
          : loading
            ? t("pricing.redirecting")
            : t("pricing.choosePlan").replace("{plan}", label)}
      </button>
    </motion.div>
  );
}
