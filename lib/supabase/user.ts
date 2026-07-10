import type { User } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/authStore";

function resolveProvider(user: User): AuthUser["provider"] {
  const provider = user.app_metadata?.provider as string | undefined;
  if (provider === "google") return "google";
  if (provider === "apple") return "apple";
  return "email";
}

export function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const name =
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "User";

  return {
    name,
    email: user.email ?? "",
    provider: resolveProvider(user),
  };
}
