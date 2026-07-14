"use client";

import { hasPrivateAccess } from "./privateAccess";
import { hasPaidAccess, hasServerActiveSubscription } from "./subscriptionAccess";
import {
  mirrorServerPlanToLocal,
  syncSubscriptionFromServer,
} from "./subscriptionSync";
import { isSupabaseConfigured } from "./supabase/client";
import { getSelectedPlan, useSubscriptionStore } from "./subscriptionStore";
import { useAuthStore } from "./authStore";

export const POST_LOGIN_PRICING_PATH = "/pricing?from=login";
export const PROFILE_PRICING_PATH = "/pricing?from=profile";
export const DIAGNOSIS_ONBOARDING_PATH = "/onboarding";
export const DIAGNOSIS_SIGNUP_PATH = "/signup?from=diagnosis";

export function isDiagnosisOnboardingPath(path: string | null | undefined): boolean {
  return path === DIAGNOSIS_ONBOARDING_PATH;
}

/** Where "Start my diagnosis" should send the user (account first, then questionnaire). */
export function resolveDiagnosisEntryPath(): string {
  if (hasPrivateAccess()) return DIAGNOSIS_ONBOARDING_PATH;

  const { isAuthenticated } = useAuthStore.getState();
  if (isAuthenticated) return DIAGNOSIS_ONBOARDING_PATH;

  return DIAGNOSIS_SIGNUP_PATH;
}

/** Resolves where to send the user right after a successful login. */
export async function resolvePostLoginPath(intendedPath = "/dashboard"): Promise<string> {
  if (hasPrivateAccess()) return intendedPath;
  if (!isSupabaseConfigured()) return intendedPath;

  const payload = await syncSubscriptionFromServer();
  mirrorServerPlanToLocal(hasServerActiveSubscription(payload) ? payload : null);

  if (hasServerActiveSubscription(payload)) {
    return intendedPath;
  }

  return POST_LOGIN_PRICING_PATH;
}

/** Resolves where to send the user when opening their profile from the home page. */
export async function resolveProfileEntryPath(): Promise<string> {
  if (hasPrivateAccess()) return "/dashboard";

  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  if (isAuthenticated) {
    const path = await resolvePostLoginPath("/dashboard");
    return path === POST_LOGIN_PRICING_PATH ? PROFILE_PRICING_PATH : path;
  }

  const { plan, hasSelectedPlan } = useSubscriptionStore.getState();
  if (hasPaidAccess(getSelectedPlan(plan, hasSelectedPlan))) {
    return "/dashboard";
  }

  return PROFILE_PRICING_PATH;
}
