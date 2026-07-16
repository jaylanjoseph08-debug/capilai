/** App identifier for storage keys and internal naming. */
export const APP_SLUG = "capilai";

export const STORAGE_KEYS = {
  theme: `${APP_SLUG}-theme-storage`,
  locale: `${APP_SLUG}-locale-storage`,
  profile: `${APP_SLUG}-storage`,
  auth: `${APP_SLUG}-auth-storage`,
  scanner: `${APP_SLUG}-scanner-storage`,
  calendar: `${APP_SLUG}-calendar-storage`,
  subscription: `${APP_SLUG}-subscription-storage`,
} as const;

/** One-time localStorage migrations from previous project ids. */
export const STORAGE_MIGRATIONS: { from: string; to: string }[] = [
  { from: "hairai-theme-storage", to: STORAGE_KEYS.theme },
  { from: "hairai-locale-storage", to: STORAGE_KEYS.locale },
  { from: "hairai-storage", to: STORAGE_KEYS.profile },
  { from: "hairai-auth-storage", to: STORAGE_KEYS.auth },
  { from: "hairai-scanner-storage", to: STORAGE_KEYS.scanner },
  { from: "hairai-calendar-storage", to: STORAGE_KEYS.calendar },
  { from: "hairai-subscription-storage", to: STORAGE_KEYS.subscription },
];

export const VIDEO_DB_NAME = `${APP_SLUG}-capture`;

/** Hair analysis API — Encore backend if configured, else Next.js route. */
export function getAnalyzeHairUrl(): string {
  const base = process.env.NEXT_PUBLIC_ENCORE_API_URL?.replace(/\/$/, "");
  return base ? `${base}/analyze-hair` : "/api/analyze-hair";
}
