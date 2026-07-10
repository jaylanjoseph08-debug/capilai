import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key && /^https?:\/\//.test(url));
}

/** Browser Supabase client — session persisted in localStorage by default. */
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey || !/^https?:\/\//.test(url)) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)");
  }

  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }

  return browserClient;
}

export function getAuthRedirectUrl(nextPath = "/dashboard"): string {
  if (typeof window === "undefined") return "/auth/callback";
  const next = encodeURIComponent(nextPath);
  return `${window.location.origin}/auth/callback?next=${next}`;
}
