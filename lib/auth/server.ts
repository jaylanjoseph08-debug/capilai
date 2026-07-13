import { createClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export function isSupabaseAuthConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && anonKey && /^https?:\/\//.test(url));
}

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim();
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function getSupabaseAuthConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !/^https?:\/\//.test(url)) return null;
  return { url, anonKey };
}

/** Validate a Supabase access token and return the auth user. */
async function resolveUserFromAccessToken(token: string): Promise<User | null> {
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token);
      if (!error && user) return user;
    } catch {
      // Fall through to publishable/anon client.
    }
  }

  const config = getSupabaseAuthConfig();
  if (!config) return null;

  try {
    const supabase = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/** Resolve the Supabase Auth user from a Bearer access token (API routes). */
export async function getAuthUserFromRequest(req: NextRequest): Promise<User | null> {
  try {
    const token = getBearerToken(req);
    if (!token) return null;
    return await resolveUserFromAccessToken(token);
  } catch {
    return null;
  }
}
