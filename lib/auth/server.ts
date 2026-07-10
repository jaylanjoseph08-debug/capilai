import { createClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim();
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Resolve the Supabase Auth user from a Bearer access token (API routes). */
export async function getAuthUserFromRequest(req: NextRequest): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}
