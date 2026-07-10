# Capil AI — Authentication (Supabase)

## Overview

Authentication uses **Supabase Auth** via `@supabase/supabase-js`. The UI still reads from `useAuthStore()` (Zustand), but session state is owned by Supabase and persisted in **browser localStorage**.

```
Login / Signup UI
       ↓
useAuthStore (Zustand — reactive mirror)
       ↓
getSupabase() → supabase.auth.*
       ↓
localStorage (JWT + refresh token)
```

## Environment variables

In `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://capilai.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

Optional (server-only, not used by the client auth flow yet):

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

## Supported flows

| Method | Entry point | Supabase API |
|--------|-------------|--------------|
| Email + password (login) | `/login` | `signInWithPassword` |
| Email + password (signup) | `/signup` | `signUp` + `user_metadata.full_name` |
| Google OAuth | `OAuthButton` in `BrandMarks.tsx` | `signInWithOAuth({ provider: 'google' })` |
| Apple OAuth | `OAuthButton` in `BrandMarks.tsx` | `signInWithOAuth({ provider: 'apple' })` |
| Sign out | Settings → Profil | `signOut` |

OAuth buttons live in `components/ui/BrandMarks.tsx` as `OAuthButton` (uses `GoogleMark` / `AppleMark` icons).

## OAuth redirect flow

1. User clicks **Continue with Google** (or Apple).
2. Browser redirects to the provider, then to Supabase, then back to:
   ```
   http://localhost:3000/auth/callback?next=/dashboard
   ```
3. `app/auth/callback/page.tsx` calls `exchangeCodeForSession(code)`.
4. Supabase stores the session in **localStorage**.
5. User is redirected to `next` (default `/dashboard`).

### Supabase dashboard — Redirect URLs

Add these under **Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:3000/auth/callback`
- `https://your-production-domain.com/auth/callback`

**Site URL** (dev): `http://localhost:3000`

### Google Cloud Console

In your OAuth client **Authorized redirect URIs**, include Supabase's callback:

```
https://capilai.supabase.co/auth/v1/callback
```

Enable Google provider in **Supabase → Authentication → Providers → Google** with your Client ID and Secret.

### Apple Sign In

Enable Apple in Supabase providers and configure Service ID / keys in Apple Developer. Same redirect URL pattern as Google.

## Session persistence

Configured in `lib/supabase/client.ts`:

- `persistSession: true`
- `autoRefreshToken: true`
- `storage: window.localStorage`

`AuthProvider` (in `app/layout.tsx`) calls `useAuthStore().initialize()` on mount, which:

1. Loads the current session via `getSession()`
2. Subscribes to `onAuthStateChange` for login/logout/refresh events

## Key files

| File | Role |
|------|------|
| `lib/supabase/client.ts` | Browser Supabase singleton |
| `lib/supabase/user.ts` | Maps Supabase `User` → `AuthUser` |
| `lib/authStore.ts` | Zustand store wrapping Supabase auth |
| `components/AuthProvider.tsx` | Initializes auth listener at app root |
| `components/ui/BrandMarks.tsx` | `OAuthButton` + provider icons |
| `app/auth/callback/page.tsx` | OAuth PKCE callback handler |
| `app/login/page.tsx` | Email login + OAuth |
| `app/signup/page.tsx` | Email signup + OAuth |

## Local testing — Google Sign In

1. Start the dev server:
   ```bash
   npm run dev:clean
   ```
2. Open `http://localhost:3000/login`
3. Click **Continue with Google**
4. Complete Google consent
5. You should land on `/dashboard` with a session in localStorage (key like `sb-<project-ref>-auth-token`)

### Troubleshooting

| Issue | Fix |
|-------|-----|
| `redirect_uri_mismatch` | Add Supabase callback URL in Google Console |
| Returns to login with error | Check Supabase redirect URLs include `/auth/callback` |
| `not_configured` in UI | Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Session lost on refresh | Confirm `AuthProvider` wraps the app in `layout.tsx` |

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- The anon/publishable key is safe in `NEXT_PUBLIC_*` — Row Level Security protects data.
- Email confirmation: if enabled in Supabase, signup may require email verification before `signInWithPassword` works.
