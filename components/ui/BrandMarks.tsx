"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/authStore";

export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M19.6 10.23c0-.68-.06-1.32-.17-1.94H10v3.67h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.33 2.99-7.25Z"
        fill="#E39A6B"
      />
      <path
        d="M10 20c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H1.08v2.59A10 10 0 0 0 10 20Z"
        fill="#F5EFE6"
      />
      <path d="M4.41 11.93A6 6 0 0 1 4.09 10c0-.67.11-1.32.32-1.93V5.48H1.08a10 10 0 0 0 0 9.04l3.33-2.59Z" fill="#93867B" />
      <path
        d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95 1.02 12.7 0 10 0A10 10 0 0 0 1.08 5.48l3.33 2.59C5.2 5.71 7.4 3.96 10 3.96Z"
        fill="#C97C4B"
      />
    </svg>
  );
}

export function AppleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M14.1 3.6c-.62.75-1.62 1.34-2.6 1.26-.13-1 .36-2.06.93-2.72C13.06.36 14.16-.1 15.06 0c.12 1.04-.3 2.06-.96 2.6Z" />
      <path d="M17.6 14.24c-.34.79-.5 1.14-.94 1.84-.6.97-1.46 2.19-2.52 2.2-.94.01-1.18-.62-2.46-.61-1.27 0-1.54.63-2.48.62-1.06-.01-1.87-1.1-2.48-2.07C5 13.98 4.66 10.9 5.7 8.9c.72-1.4 1.98-2.28 3.28-2.29 1.1-.02 1.98.72 2.6.72.6 0 1.7-.9 2.9-.77.49.02 1.9.2 2.8 1.5-.07.05-1.67.98-1.65 2.92.02 2.31 2.03 3.08 2.05 3.09Z" />
    </svg>
  );
}

type OAuthProvider = "google" | "apple";

export function OAuthButton({
  provider,
  label,
  nextPath = "/dashboard",
  onError,
  className = "flex h-14 items-center justify-center gap-3 rounded-full border border-line font-body text-sm text-cream transition hover:border-copper/50 disabled:opacity-60",
}: {
  provider: OAuthProvider;
  label: string;
  nextPath?: string;
  onError?: (message: string) => void;
  className?: string;
}) {
  const signInWithProvider = useAuthStore((s) => s.signInWithProvider);
  const isConfigured = useAuthStore((s) => s.isConfigured);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!isConfigured) {
      onError?.("not_configured");
      return;
    }
    setLoading(true);
    const result = await signInWithProvider(provider, nextPath);
    setLoading(false);
    if (result.error) onError?.(result.error);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {provider === "google" ? <GoogleMark /> : <AppleMark />}
      {loading ? "…" : label}
    </button>
  );
}
