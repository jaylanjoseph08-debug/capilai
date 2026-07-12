"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAdminLiveData } from "@/lib/adminApi";
import type { AdminLiveData } from "@/lib/adminLive";
import type { AdminUser, ModerationItem } from "@/lib/adminMockData";
import { useTranslation } from "@/lib/useTranslation";
import type { TranslationKey } from "@/lib/i18n";

type Tab = "overview" | "users" | "reports" | "products" | "monitoring";

const TAB_KEYS: [Tab, TranslationKey][] = [
  ["overview", "admin.tabs.overview"],
  ["users", "admin.tabs.users"],
  ["reports", "admin.tabs.reports"],
  ["products", "admin.tabs.products"],
  ["monitoring", "admin.tabs.monitoring"],
];

type LoadState = "loading" | "ready" | "unauthorized" | "error";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [data, setData] = useState<AdminLiveData | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState("loading");
      const result = await fetchAdminLiveData();
      if (cancelled) return;

      if (!result) {
        setLoadState("unauthorized");
        return;
      }

      setData(result);
      setLoadState("ready");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-ink-radial px-6 pb-16 pt-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/settings" className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-copper">
            ← {t("admin.back")}
          </Link>
          <span className="font-display text-lg italic text-cream">{t("admin.title")}</span>
        </div>

        <p className="mb-6 rounded-2xl border border-copper/30 bg-copper/10 p-3 font-body text-xs text-cream/80">
          {t("admin.liveNote")}
        </p>

        {loadState === "loading" && (
          <p className="font-body text-sm text-muted">{t("common.loading")}</p>
        )}

        {loadState === "unauthorized" && (
          <p className="rounded-2xl border border-copper/40 bg-copper/5 p-4 font-body text-sm text-copper-light">
            {t("admin.unauthorized")}
          </p>
        )}

        {loadState === "ready" && data && (
          <>
            <div className="mb-8 flex gap-2 overflow-x-auto rounded-full border border-line p-1">
              {TAB_KEYS.map(([value, labelKey]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-body text-xs transition ${
                    tab === value ? "bg-copper-gradient font-semibold text-ink" : "text-muted"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>

            {tab === "overview" && <OverviewTab stats={data.stats} />}
            {tab === "users" && <UsersTab users={data.users} emptyLabel={t("admin.emptyUsers")} />}
            {tab === "reports" && <ReportsTab reports={data.reports} emptyLabel={t("admin.emptyReports")} />}
            {tab === "products" && <ProductsTab moderation={data.moderation} emptyLabel={t("admin.emptyProducts")} />}
            {tab === "monitoring" && <MonitoringTab metrics={data.monitoring} />}
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-3xl p-5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</span>
      <p className="mt-1 font-display text-2xl text-cream">{value}</p>
    </div>
  );
}

function OverviewTab({ stats }: { stats: AdminLiveData["stats"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Utilisateurs" value={stats.totalUsers} />
      <StatCard label="Payants actifs" value={stats.paying} />
      <StatCard label="En essai" value={stats.trial} />
      <StatCard label="Résiliés" value={stats.churned} />
      <StatCard label="MRR estimé" value={`${stats.mrr.toFixed(2)}€`} />
      <StatCard label="Score moyen" value={stats.avgScore ?? "—"} />
      <StatCard label="Analyses (total)" value={stats.analysesTotal} />
    </div>
  );
}

function PlanBadge({ plan }: { plan: "free" | "premium" | "pro" }) {
  const tone = plan === "pro" ? "#E8B86D" : plan === "premium" ? "#C97C4B" : "#93867B";
  return (
    <span className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase" style={{ backgroundColor: `${tone}22`, color: tone }}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: AdminUser["status"] }) {
  const tone = status === "active" ? "#8FBF8A" : status === "essai" ? "#E8B86D" : "#D97757";
  return (
    <span className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase" style={{ backgroundColor: `${tone}22`, color: tone }}>
      {status}
    </span>
  );
}

function UsersTab({ users, emptyLabel }: { users: AdminUser[]; emptyLabel: string }) {
  if (users.length === 0) {
    return <p className="font-body text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="glass overflow-x-auto rounded-3xl p-2">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-widest text-muted">
            <th className="px-3 py-3">Nom</th>
            <th className="px-3 py-3">Plan</th>
            <th className="px-3 py-3">Statut</th>
            <th className="px-3 py-3">Inscrit le</th>
            <th className="px-3 py-3">Score</th>
            <th className="px-3 py-3">Analyses</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-line font-body text-sm text-cream/80">
              <td className="px-3 py-3">
                <p className="text-cream">{u.name}</p>
                <p className="font-mono text-[11px] text-muted">{u.email}</p>
              </td>
              <td className="px-3 py-3">
                <PlanBadge plan={u.plan} />
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={u.status} />
              </td>
              <td className="px-3 py-3 text-xs text-muted">{u.signupDate}</td>
              <td className="px-3 py-3">{u.lastScore ?? "—"}</td>
              <td className="px-3 py-3">{u.analysesCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsTab({
  reports,
  emptyLabel,
}: {
  reports: AdminLiveData["reports"];
  emptyLabel: string;
}) {
  if (reports.length === 0) {
    return <p className="font-body text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {reports.map((r) => (
        <div key={r.id} className="glass flex items-center justify-between rounded-2xl p-4">
          <div>
            <p className="font-body text-sm text-cream">{r.userName}</p>
            <p className="mt-0.5 font-body text-xs text-muted">
              {r.generatedAt} · Priorité : {r.topPriority}
            </p>
          </div>
          <span className="font-mono text-sm text-copper-light">{r.score}/100</span>
        </div>
      ))}
    </div>
  );
}

function ProductsTab({
  moderation,
  emptyLabel,
}: {
  moderation: ModerationItem[];
  emptyLabel: string;
}) {
  const [queue, setQueue] = useState<ModerationItem[]>(moderation);

  useEffect(() => {
    setQueue(moderation);
  }, [moderation]);

  if (queue.length === 0) {
    return <p className="font-body text-sm text-muted">{emptyLabel}</p>;
  }

  function setStatus(id: string, status: ModerationItem["status"]) {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  return (
    <div>
      <h2 className="mb-3 font-display text-lg text-cream">File de modération produits</h2>
      <div className="flex flex-col gap-2">
        {queue.map((item) => (
          <div key={item.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-body text-sm text-cream">{item.productName}</p>
                <p className="font-body text-xs text-muted">{item.brand}</p>
                <p className="mt-1 font-body text-xs text-muted">{item.reason}</p>
              </div>
              <span className="flex-shrink-0 font-mono text-[10px] uppercase text-copper-light">{item.status}</span>
            </div>
            {item.status === "en attente" && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setStatus(item.id, "approuvé")}
                  className="flex-1 rounded-full bg-copper-gradient py-2 font-body text-xs font-semibold text-ink"
                >
                  Approuver
                </button>
                <button
                  onClick={() => setStatus(item.id, "rejeté")}
                  className="flex-1 rounded-full border border-line py-2 font-body text-xs text-cream/80"
                >
                  Rejeter
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonitoringTab({ metrics }: { metrics: AdminLiveData["monitoring"] }) {
  return (
    <div className="flex flex-col gap-2">
      {metrics.map((m) => {
        const tone = m.tone === "ok" ? "#8FBF8A" : m.tone === "warn" ? "#E8B86D" : "#D97757";
        return (
          <div key={m.label} className="glass flex items-center justify-between rounded-2xl p-4">
            <span className="font-body text-sm text-cream/80">{m.label}</span>
            <span className="flex items-center gap-2 font-body text-xs" style={{ color: tone }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />
              {m.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
