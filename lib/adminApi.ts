import type { AdminLiveData } from "./adminLive";

export async function fetchAdminLiveData(): Promise<AdminLiveData | null> {
  const { getAccessToken } = await import("./supabase/session");
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch("/api/admin", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminLiveData;
  } catch {
    return null;
  }
}
