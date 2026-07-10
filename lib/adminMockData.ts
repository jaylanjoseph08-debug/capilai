/**
 * Deterministic demo data for /admin. In Phase 3 every function here is
 * replaced by a query against the tables in prisma/schema.prisma
 * (User, Subscription, Analysis, Report, Product…) run behind an
 * admin-only auth check — the page itself won't need to change shape.
 */

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: "free" | "premium" | "pro";
  status: "active" | "essai" | "résilié";
  signupDate: string;
  lastScore: number | null;
  analysesCount: number;
}

export const ADMIN_USERS: AdminUser[] = [
  { id: "u1", name: "Léa Fontaine", email: "lea.fontaine@example.com", plan: "pro", status: "active", signupDate: "2026-01-14", lastScore: 78, analysesCount: 6 },
  { id: "u2", name: "Yanis Belkacem", email: "y.belkacem@example.com", plan: "premium", status: "active", signupDate: "2026-02-02", lastScore: 64, analysesCount: 4 },
  { id: "u3", name: "Chloé Marchand", email: "chloe.marchand@example.com", plan: "free", status: "active", signupDate: "2026-02-19", lastScore: 71, analysesCount: 1 },
  { id: "u4", name: "Mathis Robert", email: "mathis.robert@example.com", plan: "premium", status: "essai", signupDate: "2026-06-24", lastScore: null, analysesCount: 0 },
  { id: "u5", name: "Awa Diallo", email: "awa.diallo@example.com", plan: "pro", status: "active", signupDate: "2025-11-30", lastScore: 82, analysesCount: 11 },
  { id: "u6", name: "Nathan Perrot", email: "nathan.perrot@example.com", plan: "free", status: "résilié", signupDate: "2025-10-05", lastScore: 58, analysesCount: 2 },
  { id: "u7", name: "Inès Cohen", email: "ines.cohen@example.com", plan: "premium", status: "active", signupDate: "2026-03-11", lastScore: 69, analysesCount: 5 },
  { id: "u8", name: "Tom Lefebvre", email: "tom.lefebvre@example.com", plan: "free", status: "active", signupDate: "2026-05-28", lastScore: 61, analysesCount: 1 },
  { id: "u9", name: "Salomé Girard", email: "salome.girard@example.com", plan: "pro", status: "active", signupDate: "2026-01-02", lastScore: 74, analysesCount: 8 },
  { id: "u10", name: "Adam Benali", email: "adam.benali@example.com", plan: "premium", status: "essai", signupDate: "2026-06-29", lastScore: null, analysesCount: 0 },
];

export interface AdminReport {
  id: string;
  userName: string;
  generatedAt: string;
  score: number;
  topPriority: string;
}

export const ADMIN_REPORTS: AdminReport[] = [
  { id: "r1", userName: "Awa Diallo", generatedAt: "2026-07-01", score: 82, topPriority: "Définir les boucles" },
  { id: "r2", userName: "Léa Fontaine", generatedAt: "2026-06-29", score: 78, topPriority: "Réduire la casse" },
  { id: "r3", userName: "Salomé Girard", generatedAt: "2026-06-27", score: 74, topPriority: "Favoriser la pousse" },
  { id: "r4", userName: "Inès Cohen", generatedAt: "2026-06-25", score: 69, topPriority: "Hydrater" },
  { id: "r5", userName: "Yanis Belkacem", generatedAt: "2026-06-22", score: 64, topPriority: "Réduire les frisottis" },
];

export interface ModerationItem {
  id: string;
  productName: string;
  brand: string;
  reason: string;
  status: "en attente" | "approuvé" | "rejeté";
}

export const MODERATION_QUEUE: ModerationItem[] = [
  { id: "m1", productName: "Crème boucles définition", brand: "CurlCraft", reason: "Composition incomplète (INCI partiel)", status: "en attente" },
  { id: "m2", productName: "Shampoing solide surgras", brand: "Racines", reason: "Signalé par un utilisateur : score incohérent", status: "en attente" },
  { id: "m3", productName: "Sérum brillance", brand: "Botaniqa Lab", reason: "Doublon possible avec un produit existant", status: "approuvé" },
];

export interface MonitoringMetric {
  label: string;
  value: string;
  tone: "ok" | "warn" | "down";
}

export const MONITORING: MonitoringMetric[] = [
  { label: "API Open Beauty Facts", value: "Opérationnelle", tone: "ok" },
  { label: "Pipeline d'analyse", value: "Opérationnel", tone: "ok" },
  { label: "Webhooks Stripe", value: "Non configuré", tone: "warn" },
  { label: "Temps de réponse moyen", value: "312 ms", tone: "ok" },
  { label: "Erreurs (24h)", value: "3", tone: "warn" },
];

export function getStats() {
  const totalUsers = ADMIN_USERS.length;
  const paying = ADMIN_USERS.filter((u) => u.plan !== "free" && u.status === "active").length;
  const trial = ADMIN_USERS.filter((u) => u.status === "essai").length;
  const churned = ADMIN_USERS.filter((u) => u.status === "résilié").length;
  const avgScore = Math.round(
    ADMIN_USERS.filter((u) => u.lastScore !== null).reduce((sum, u) => sum + (u.lastScore ?? 0), 0) /
      ADMIN_USERS.filter((u) => u.lastScore !== null).length
  );
  const mrr = ADMIN_USERS.reduce((sum, u) => {
    if (u.status !== "active") return sum;
    if (u.plan === "premium") return sum + 9.99;
    if (u.plan === "pro") return sum + 16.99;
    return sum;
  }, 0);

  return {
    totalUsers,
    paying,
    trial,
    churned,
    avgScore,
    mrr: Math.round(mrr * 100) / 100,
    analysesThisWeek: ADMIN_USERS.reduce((sum, u) => sum + u.analysesCount, 0),
  };
}
