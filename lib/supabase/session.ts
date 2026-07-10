import { getSupabase, isSupabaseConfigured } from "./client";

/** Bearer token for authenticated API routes (server-side verification). */
export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session?.access_token ?? null;
}
