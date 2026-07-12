import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase/admin";
import { isSupabaseAdminConfigured } from "./supabase/admin";
import { isStripeConfigured } from "./stripe-server";
import { isActiveSubscriptionStatus, type DbSubscription } from "./subscription-db";
import { PLAN_PRICES } from "./pricing";
import type { Plan, BillingCycle } from "./subscriptionStore";
import type {
  AdminUser,
  AdminReport,
  ModerationItem,
  MonitoringMetric,
} from "./adminMockData";

export type AdminStats = {
  totalUsers: number;
  paying: number;
  trial: number;
  churned: number;
  avgScore: number | null;
  mrr: number;
  analysesTotal: number;
};

export type AdminLiveData = {
  configured: boolean;
  stats: AdminStats;
  users: AdminUser[];
  reports: AdminReport[];
  moderation: ModerationItem[];
  monitoring: MonitoringMetric[];
};

function mapSubscriptionStatus(
  status: DbSubscription["status"]
): AdminUser["status"] {
  if (status === "trialing") return "essai";
  if (status === "canceled" || status === "inactive" || status === "past_due" || status === "unpaid") {
    return "résilié";
  }
  return "active";
}

function monthlyRevenue(plan: Plan, billingCycle: BillingCycle | null, status: DbSubscription["status"]): number {
  if (!isActiveSubscriptionStatus(status)) return 0;
  const prices = PLAN_PRICES[plan];
  if (status === "lifetime" || billingCycle === "annual") {
    return Math.round((prices.annual / 12) * 100) / 100;
  }
  return prices.monthly;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return iso.slice(0, 10);
  } catch {
    return "—";
  }
}

async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
    page += 1;
  }
  return users;
}

async function listAllSubscriptions(admin: SupabaseClient): Promise<DbSubscription[]> {
  const { data, error } = await admin.from("subscriptions").select("*");
  if (error) throw error;
  return (data as DbSubscription[]) ?? [];
}

export async function fetchAdminLiveData(): Promise<AdminLiveData> {
  if (!isSupabaseAdminConfigured()) {
    return emptyAdminData(false);
  }

  const admin = getSupabaseAdmin();
  const [authUsers, subscriptions] = await Promise.all([
    listAllAuthUsers(admin),
    listAllSubscriptions(admin),
  ]);

  const subByUser = new Map(subscriptions.map((s) => [s.user_id, s]));

  const users: AdminUser[] = authUsers.map((u) => {
    const sub = subByUser.get(u.id);
    const meta = u.user_metadata ?? {};
    const name =
      (meta.full_name as string | undefined) ||
      (meta.name as string | undefined) ||
      u.email?.split("@")[0] ||
      "Utilisateur";

    return {
      id: u.id,
      name,
      email: u.email ?? "",
      plan: sub?.plan ?? "free",
      status: sub ? mapSubscriptionStatus(sub.status) : "essai",
      signupDate: formatDate(u.created_at),
      lastScore: null,
      analysesCount: 0,
    };
  });

  const paying = users.filter((u) => u.plan !== "free" && u.status === "active").length;
  const trial = users.filter((u) => u.status === "essai").length;
  const churned = users.filter((u) => u.status === "résilié").length;

  const mrr = subscriptions.reduce((sum, sub) => {
    return sum + monthlyRevenue(sub.plan, sub.billing_cycle, sub.status);
  }, 0);

  const stats: AdminStats = {
    totalUsers: users.length,
    paying,
    trial,
    churned,
    avgScore: null,
    mrr: Math.round(mrr * 100) / 100,
    analysesTotal: 0,
  };

  return {
    configured: true,
    stats,
    users: users.sort((a, b) => b.signupDate.localeCompare(a.signupDate)),
    reports: [],
    moderation: [],
    monitoring: buildMonitoringMetrics(),
  };
}

function buildMonitoringMetrics(): MonitoringMetric[] {
  const stripeOk = isStripeConfigured();
  const supabaseOk = isSupabaseAdminConfigured();
  const openaiOk = Boolean(process.env.OPENAI_API_KEY?.trim());

  return [
    {
      label: "Supabase (service role)",
      value: supabaseOk ? "Connecté" : "Non configuré",
      tone: supabaseOk ? "ok" : "down",
    },
    {
      label: "Stripe",
      value: stripeOk ? "Connecté" : "Non configuré",
      tone: stripeOk ? "ok" : "warn",
    },
    {
      label: "OpenAI",
      value: openaiOk ? "Connecté" : "Non configuré",
      tone: openaiOk ? "ok" : "warn",
    },
    {
      label: "Webhooks Stripe",
      value: process.env.STRIPE_WEBHOOK_SECRET?.trim() ? "Configuré" : "Non configuré",
      tone: process.env.STRIPE_WEBHOOK_SECRET?.trim() ? "ok" : "warn",
    },
    {
      label: "Open Beauty Facts",
      value: "Opérationnel",
      tone: "ok",
    },
  ];
}

function emptyAdminData(configured: boolean): AdminLiveData {
  return {
    configured,
    stats: {
      totalUsers: 0,
      paying: 0,
      trial: 0,
      churned: 0,
      avgScore: null,
      mrr: 0,
      analysesTotal: 0,
    },
    users: [],
    reports: [],
    moderation: [],
    monitoring: buildMonitoringMetrics(),
  };
}
