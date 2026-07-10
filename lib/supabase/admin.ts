import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function isSupabaseAdminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && serviceKey && /^https?:\/\//.test(url));
}

/** Server-only Supabase client with service role (bypasses RLS). */
export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return adminClient;
}
