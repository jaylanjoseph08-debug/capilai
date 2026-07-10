"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-radial px-6 text-center">
      <h1 className="font-display text-2xl text-cream">Something went wrong</h1>
      <p className="mt-3 max-w-sm font-body text-sm text-muted">
        An unexpected error occurred. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 h-12 rounded-full bg-copper-gradient px-8 font-body text-sm font-semibold text-ink shadow-glow"
      >
        Try again
      </button>
    </main>
  );
}
