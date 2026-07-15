"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { deleteProfileOnServer } from "@/lib/hairProfileSync";
import { useHairAIStore } from "@/lib/store";
import { useScannerStore } from "@/lib/scannerStore";
import { useCalendarStore } from "@/lib/calendarStore";
import { getSelectedPlan, useSubscriptionStore } from "@/lib/subscriptionStore";
import { useSelectedPlan } from "@/lib/useSelectedPlan";
import { useSubscriptionSyncStore } from "@/lib/subscriptionSyncStore";
import { cancelSubscriptionOnServer } from "@/lib/subscriptionCancel";
import {
  mirrorServerPlanToLocal,
  forceSyncSubscriptionFromServer,
  syncSubscriptionFromServer,
} from "@/lib/subscriptionSync";
import { getPendingCheckoutSessionId } from "@/lib/pendingCheckoutSession";
import { hasServerActiveSubscription } from "@/lib/subscriptionAccess";
import { useLocaleStore, type Locale } from "@/lib/locale";
import { LOCALE_LABELS } from "@/lib/i18n";
import { useTranslation } from "@/lib/useTranslation";
import { CheckoutSuccessSync } from "@/components/CheckoutSuccessSync";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BottomNav } from "@/components/ui/BottomNav";

type Tab = "profil" | "abonnement" | "parametres";

export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("profil");

  const tabs: [Tab, string][] = [
    ["profil", t("settings.tabs.profile")],
    ["abonnement", t("settings.tabs.subscription")],
    ["parametres", t("settings.tabs.settings")],
  ];

  return (
    <main className="min-h-screen bg-ink-radial px-6 pb-28 pt-10">
      <Suspense fallback={null}>
        <CheckoutSuccessSync redirectPath="/settings" onSuccess={() => setTab("abonnement")} />
      </Suspense>
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
            ← {t("settings.back")}
          </Link>
          <span className="font-display text-lg italic text-cream">{t("settings.title")}</span>
        </div>

        <div className="mb-6 flex gap-2 rounded-full border border-line p-1">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex-1 rounded-full py-2 font-body text-xs transition ${
                tab === value ? "bg-copper-gradient text-ink font-semibold" : "text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "profil" && <ProfilTab />}
        {tab === "abonnement" && <AbonnementTab />}
        {tab === "parametres" && <ParametresTab />}

        {process.env.NODE_ENV === 'development' && (
          <Link
            href="/admin"
            className="mt-10 block text-center font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper"
          >
            {t("settings.adminLink")}
          </Link>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function ProfilTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, updateProfile, signOut } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (!user) {
    return (
      <div className="glass flex flex-col items-center rounded-3xl px-6 py-10 text-center">
        <p className="mb-5 font-body text-sm text-muted">{t("settings.notSignedIn")}</p>
        <Link
          href="/login"
          className="flex h-12 items-center rounded-full bg-copper-gradient px-6 font-body text-sm font-semibold text-ink shadow-glow"
        >
          {t("settings.signIn")}
        </Link>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const result = await updateProfile({ name, email });
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div>
      <form onSubmit={handleSave} className="glass mb-4 flex flex-col gap-3 rounded-3xl p-5">
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted">{t("settings.firstName")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-xl border border-line bg-surface px-4 font-body text-sm text-cream focus:border-copper/60 focus:outline-none"
        />
        <label className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">{t("settings.email")}</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-xl border border-line bg-surface px-4 font-body text-sm text-cream focus:border-copper/60 focus:outline-none"
        />
        <button
          type="submit"
          className="mt-2 flex h-12 items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink transition active:scale-[0.98]"
        >
          {saved ? t("settings.saved") : t("settings.save")}
        </button>
        {saveError && <p className="font-body text-xs text-copper-light">{saveError}</p>}
      </form>

      <button
        onClick={async () => {
          await signOut();
          router.push("/");
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line font-body text-sm text-cream/80 transition hover:border-copper/50"
      >
        <LogOut size={15} /> {t("settings.signOut")}
      </button>
    </div>
  );
}

function AbonnementTab() {
  const { t, planLabel, locale } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const syncReady = useSubscriptionSyncStore((s) => s.ready);
  const serverSubscription = useSubscriptionSyncStore((s) => s.serverSubscription);
  const setServerSubscription = useSubscriptionSyncStore((s) => s.setServerSubscription);
  const { billingCycle, hasSelectedPlan } = useSubscriptionStore();
  const plan = useSelectedPlan();
  const selectedPlan = plan ?? getSelectedPlan(useSubscriptionStore.getState().plan, hasSelectedPlan);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const hasActivePlan = hasServerActiveSubscription(serverSubscription);

  const canCancel = Boolean(serverSubscription?.canCancel);
  const cancelAtPeriodEnd = Boolean(serverSubscription?.cancelAtPeriodEnd);
  const periodEnd = serverSubscription?.currentPeriodEnd;

  function formatPeriodEnd(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
        dateStyle: "long",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  async function handleCancel() {
    if (!window.confirm(t("settings.cancelPlanConfirm"))) return;

    setCancelling(true);
    setError("");
    setNotice("");

    const cancelResult = await cancelSubscriptionOnServer();
    if (!cancelResult.ok) {
      setCancelling(false);
      if (cancelResult.code === "LIFETIME_NOT_CANCELLABLE") {
        setError(t("settings.cancelPlanLifetime"));
        return;
      }
      if (cancelResult.code === "NO_STRIPE_SUBSCRIPTION") {
        setError(t("settings.cancelPlanNoBilling"));
        return;
      }
      setError(cancelResult.error ?? t("settings.cancelPlanError"));
      return;
    }

    const syncResult = await syncSubscriptionFromServer();
    const payload = syncResult.payload;
    if (payload) {
      setServerSubscription(payload);
      mirrorServerPlanToLocal(hasServerActiveSubscription(payload) ? payload : null);
    }

    setCancelling(false);
    setNotice(
      t("settings.cancelPlanDone").replace("{date}", formatPeriodEnd(cancelResult.currentPeriodEnd ?? periodEnd))
    );
  }

  async function handleSyncSubscription() {
    setSyncing(true);
    setError("");
    setNotice("");

    const payload = await forceSyncSubscriptionFromServer(getPendingCheckoutSessionId() ?? undefined);
    if (payload) {
      setServerSubscription(payload);
      mirrorServerPlanToLocal(hasServerActiveSubscription(payload) ? payload : null);
    }

    setSyncing(false);

    if (hasServerActiveSubscription(payload)) {
      setNotice(t("settings.syncSubscriptionDone"));
      return;
    }

    setError(t("settings.syncSubscriptionFailed"));
  }

  return (
    <div>
      <div className="glass mb-4 rounded-3xl p-5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{t("settings.currentPlan")}</span>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-display text-2xl text-cream">
            {selectedPlan ? planLabel(selectedPlan) : t("settings.noPlan")}
          </span>
          {selectedPlan && (
            <span className="font-body text-xs text-muted">
              {billingCycle === "monthly" ? t("settings.billingMonthly") : t("settings.billingAnnual")}
            </span>
          )}
        </div>
      </div>

      {cancelAtPeriodEnd && periodEnd && (
        <p className="mb-4 rounded-2xl border border-copper/30 bg-copper/10 p-3 text-center font-body text-xs text-cream/80">
          {t("settings.cancelPlanScheduled").replace("{date}", formatPeriodEnd(periodEnd))}
        </p>
      )}

      {notice && (
        <p className="mb-4 rounded-2xl border border-copper/30 bg-copper/10 p-3 text-center font-body text-xs text-cream/80">
          {notice}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-2xl border border-copper/40 bg-copper/5 p-3 text-center font-body text-xs text-copper-light">
          {error}
        </p>
      )}

      <Link
        href="/pricing"
        className="glass mb-3 flex items-center justify-between rounded-3xl p-5 transition hover:border-copper/30"
      >
        <div>
          <p className="font-body text-sm text-cream">
            {!selectedPlan ? t("settings.choosePlan") : t("settings.managePlan")}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">{t("settings.viewPlans")}</p>
        </div>
        <ChevronRight size={18} className="text-muted" />
      </Link>

      {isAuthenticated && syncReady && !hasActivePlan && (
        <button
          type="button"
          onClick={handleSyncSubscription}
          disabled={syncing}
          className="mb-3 flex h-12 w-full flex-col items-center justify-center rounded-full bg-copper-gradient font-body text-sm font-semibold text-ink shadow-glow transition active:scale-[0.98] disabled:opacity-60"
        >
          <span>{syncing ? t("settings.syncSubscriptionLoading") : t("settings.syncSubscription")}</span>
          {!syncing && (
            <span className="mt-0.5 font-body text-[10px] font-normal text-ink/70">
              {t("settings.syncSubscriptionApplePayHint")}
            </span>
          )}
        </button>
      )}

      {isAuthenticated && syncReady && canCancel && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="flex h-12 w-full items-center justify-center rounded-full border border-copper/30 font-body text-sm text-copper-light transition hover:bg-copper/10 disabled:opacity-60"
        >
          {cancelling ? t("settings.cancelPlanCancelling") : t("settings.cancelPlan")}
        </button>
      )}
    </div>
  );
}

function ParametresTab() {
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [notifications, setNotifications] = useState(true);
  const hairStore = useHairAIStore();
  const scannerStore = useScannerStore();
  const calendarStore = useCalendarStore();
  const authStore = useAuthStore();

  async function resetAll() {
    if (!window.confirm(t("settings.resetConfirm"))) return;
    hairStore.reset();
    await deleteProfileOnServer();
    calendarStore.events.forEach((e) => calendarStore.removeEvent(e.id));
    scannerStore.closet.forEach((r) => scannerStore.removeFromCloset(r.product.barcode));
    authStore.signOut();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="glass flex items-center justify-between rounded-3xl p-5">
        <div>
          <p className="font-body text-sm text-cream">{t("settings.theme")}</p>
          <p className="mt-0.5 font-body text-xs text-muted">{t("settings.themeHint")}</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="glass flex items-center justify-between rounded-3xl p-5">
        <div>
          <p className="font-body text-sm text-cream">{t("settings.notifications")}</p>
          <p className="mt-0.5 font-body text-xs text-muted">{t("settings.notificationsHint")}</p>
        </div>
        <button
          onClick={() => setNotifications((n) => !n)}
          aria-label={t("settings.notifications")}
          className={`relative h-7 w-12 rounded-full transition ${notifications ? "bg-copper" : "bg-hairline/15"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-cream transition ${
              notifications ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      <div className="glass rounded-3xl p-5">
        <p className="mb-3 font-body text-sm text-cream">{t("settings.language")}</p>
        <div className="flex gap-2 rounded-full border border-line p-1">
          {(["fr", "en"] as Locale[]).map((value) => (
            <button
              key={value}
              onClick={() => setLocale(value)}
              className={`flex-1 rounded-full py-2 font-body text-xs transition ${
                locale === value ? "bg-copper-gradient font-semibold text-ink" : "text-muted"
              }`}
            >
              {LOCALE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={resetAll}
        className="mt-3 flex h-12 items-center justify-center rounded-full border border-copper/30 font-body text-sm text-copper-light transition hover:bg-copper/10"
      >
        {t("settings.resetData")}
      </button>
    </div>
  );
}
