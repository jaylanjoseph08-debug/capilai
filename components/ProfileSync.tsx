"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useHairAIStore } from "@/lib/store";
import {
  fetchProfileFromServer,
  mergeProfileHistory,
  profileGeneratedAtMs,
  saveProfileToServer,
} from "@/lib/hairProfileSync";
import { useProfileSyncStore } from "@/lib/profileSyncStore";

/** Loads hair profile from Supabase after auth — server wins when newer. */
export function ProfileSync() {
  const isConfigured = useAuthStore((s) => s.isConfigured);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const markReady = useProfileSyncStore((s) => s.markReady);
  const reset = useProfileSyncStore((s) => s.reset);

  useEffect(() => {
    if (!isSupabaseConfigured() || !isConfigured) {
      markReady();
      return;
    }

    if (isLoading) return;

    if (!isAuthenticated) {
      reset();
      markReady();
      return;
    }

    let cancelled = false;
    reset();

    async function sync() {
      const payload = await fetchProfileFromServer();
      if (cancelled) return;

      if (!payload?.configured) {
        markReady();
        return;
      }

      const local = useHairAIStore.getState();
      const serverProfileTs = profileGeneratedAtMs(payload.profile);
      const localProfileTs = profileGeneratedAtMs(local.profile);

      const serverEmpty = !payload.profile && Object.keys(payload.answers).length === 0;
      const localEmpty = !local.profile && Object.keys(local.answers).length === 0;

      if (serverEmpty && !localEmpty) {
        await saveProfileToServer({
          answers: local.answers,
          profile: local.profile,
          history: local.history,
        });
        markReady();
        return;
      }

      if (!serverEmpty && (localEmpty || serverProfileTs >= localProfileTs)) {
        useHairAIStore.getState().replaceFromServer({
          answers: payload.answers,
          profile: payload.profile,
          history: mergeProfileHistory(local.history, payload.history),
        });
        markReady();
        return;
      }

      if (!localEmpty && localProfileTs > serverProfileTs) {
        await saveProfileToServer({
          answers: local.answers,
          profile: local.profile,
          history: local.history,
        });
        markReady();
        return;
      }

      markReady();
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [isConfigured, isLoading, isAuthenticated, markReady, reset]);

  return null;
}
