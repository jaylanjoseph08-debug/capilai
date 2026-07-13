import type { Plan, BillingCycle } from "./plans";
import { getPlanFeatures, PLAN_FEATURES as I18N_PLAN_FEATURES } from "./i18n";
import type { Locale } from "./locale";
import { isLifetimePrice } from "./plans";

export type { Plan, BillingCycle } from "./plans";

export const PLAN_PRICES: Record<Plan, Record<BillingCycle, number>> = {
  free: { monthly: 9.9, annual: 99 },
  premium: { monthly: 19.9, annual: 199 },
  pro: { monthly: 39.9, annual: 399 },
};

/** @deprecated use getPlanFeatures(locale, plan) */
export const PLAN_FEATURES: Record<Plan, string[]> = I18N_PLAN_FEATURES.en;

export { getPlanFeatures };

/** Premium annual = one-time lifetime payment */
export { isLifetimePrice } from "./plans";

export function annualSavingsPercent(plan: Plan): number {
  const monthlyTotal = PLAN_PRICES[plan].monthly * 12;
  const annual = PLAN_PRICES[plan].annual;
  return Math.round(((monthlyTotal - annual) / monthlyTotal) * 100);
}

export function formatPrice(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function lifetimeFeatureLabel(locale: Locale): string {
  return locale === "fr" ? "Accès à vie" : "Lifetime access";
}
