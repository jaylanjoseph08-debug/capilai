"use client";

import { create } from "zustand";
import { getAuthRedirectUrl, getSupabase, isSupabaseConfigured } from "./supabase/client";
import { parseSupabaseAuthError } from "./supabase/auth-errors";
import { mapSupabaseUser } from "./supabase/user";

export interface AuthUser {
  name: string;
  email: string;
  provider: "email" | "google" | "apple";
}

type AuthResult = {
  error?: string;
  needsEmailConfirmation?: boolean;
  emailSent?: boolean;
};

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  signUp: (name: string, email: string, password: string, nextPath?: string) => Promise<AuthResult>;
  resendSignupConfirmation: (email: string, nextPath?: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithProvider: (provider: "google" | "apple", nextPath?: string) => Promise<AuthResult>;
  updateProfile: (fields: Partial<Pick<AuthUser, "name" | "email">>) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Subscribe to Supabase auth state; call once at app mount. Returns cleanup. */
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isConfigured: isSupabaseConfigured(),

  initialize: () => {
    if (!isSupabaseConfigured()) {
      set({ isLoading: false, isConfigured: false });
      return () => {};
    }

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = mapSupabaseUser(session?.user ?? null);
      set({ user, isAuthenticated: Boolean(user), isLoading: false, isConfigured: true });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = mapSupabaseUser(session?.user ?? null);
      set({ user, isAuthenticated: Boolean(user), isLoading: false, isConfigured: true });
    });

    return () => subscription.unsubscribe();
  },

  signUp: async (name, email, password, nextPath = "/dashboard") => {
    if (!isSupabaseConfigured()) return { error: "not_configured" };
    const supabase = getSupabase();
    const emailRedirectTo = getAuthRedirectUrl(nextPath);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, name },
        emailRedirectTo,
      },
    });
    if (error) return { error: error.message };

    if (data.user?.identities?.length === 0) {
      return { error: "already_registered" };
    }

    if (data.session?.user) {
      const user = mapSupabaseUser(data.session.user);
      set({ user, isAuthenticated: Boolean(user), isLoading: false, isConfigured: true });
      return {};
    }

    if (data.user && !data.session) {
      let emailSent = Boolean(data.user.confirmation_sent_at);
      if (!emailSent) {
        const resendResult = await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo },
        });
        if (!resendResult.error) {
          emailSent = true;
        } else {
          return { error: resendResult.error.message };
        }
      }

      return { needsEmailConfirmation: true, emailSent };
    }

    return { error: "auth_failed" };
  },

  resendSignupConfirmation: async (email, nextPath = "/dashboard") => {
    if (!isSupabaseConfigured()) return { error: "not_configured" };
    const supabase = getSupabase();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: getAuthRedirectUrl(nextPath) },
    });
    if (error) return { error: error.message };
    return { needsEmailConfirmation: true, emailSent: true };
  },

  signIn: async (email, password) => {
    if (!isSupabaseConfigured()) return { error: "not_configured" };
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const user = mapSupabaseUser(data.user);
    set({ user, isAuthenticated: Boolean(user), isLoading: false, isConfigured: true });
    return {};
  },

  signInWithProvider: async (provider, nextPath = "/dashboard") => {
    if (!isSupabaseConfigured()) return { error: "not_configured" };
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthRedirectUrl(nextPath),
      },
    });
    if (error) {
      const code = parseSupabaseAuthError(error.message);
      if (code === "provider_not_enabled") {
        console.error(
          "[auth] Google OAuth is disabled in Supabase. Enable it at:",
          "https://supabase.com/dashboard → Authentication → Providers → Google"
        );
      }
      return { error: code };
    }
    return {};
  },

  updateProfile: async (fields) => {
    if (!isSupabaseConfigured()) return { error: "not_configured" };
    const supabase = getSupabase();
    const payload: { email?: string; data?: Record<string, string> } = {};
    if (fields.email) payload.email = fields.email;
    if (fields.name) payload.data = { full_name: fields.name, name: fields.name };

    const { data, error } = await supabase.auth.updateUser(payload);
    if (error) return { error: error.message };

    const user = mapSupabaseUser(data.user);
    if (user) set({ user, isAuthenticated: true });
    return {};
  },

  signOut: async () => {
    if (isSupabaseConfigured()) {
      await getSupabase().auth.signOut();
    }
    set({ user: null, isAuthenticated: false });
  },
}));
