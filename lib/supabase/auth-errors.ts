import type { TranslationKey } from "@/lib/i18n";

/** Supabase OAuth callback URL to register in Google Cloud Console. */
export function getSupabaseOAuthCallbackUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) return null;
  return `${url.replace(/\/$/, "")}/auth/v1/callback`;
}

/** Link to enable Google in the Supabase dashboard for the configured project. */
export function getSupabaseGoogleProviderUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match?.[1]) return null;
  return `https://supabase.com/dashboard/project/${match[1]}/auth/providers?provider=Google`;
}

export type ParsedAuthErrorCode = "not_configured" | "provider_not_enabled" | "auth_failed" | string;

/** Map raw Supabase Auth errors (incl. JSON payloads) to stable codes for i18n. */
export function parseSupabaseAuthError(raw: string | undefined | null): ParsedAuthErrorCode {
  if (!raw?.trim()) return "auth_failed";
  if (raw === "not_configured") return raw;

  const lower = raw.toLowerCase();
  if (lower.includes("provider is not enabled") || lower.includes("unsupported provider")) {
    return "provider_not_enabled";
  }

  try {
    const parsed = JSON.parse(raw) as { msg?: string; message?: string; error_code?: string };
    const msg = (parsed.msg ?? parsed.message ?? "").toLowerCase();
    if (msg.includes("provider is not enabled") || msg.includes("unsupported provider")) {
      return "provider_not_enabled";
    }
  } catch {
    // plain text message
  }

  return raw;
}

export function resolveAuthErrorMessage(
  t: (key: TranslationKey) => string,
  raw: string | undefined | null,
  fallbackKey: TranslationKey = "auth.login.authFailed"
): string {
  const code = parseSupabaseAuthError(raw);

  switch (code) {
    case "not_configured":
      return t("auth.login.notConfigured");
    case "provider_not_enabled":
      return t("auth.oauth.providerNotEnabled");
    case "auth_failed":
      return t(fallbackKey);
    default:
      return code;
  }
}
