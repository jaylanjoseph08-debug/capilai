"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-body bg-ink text-cream antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-2xl">Something went wrong</h1>
          <p className="mt-3 font-body text-sm text-muted">Please reload the page.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-full bg-[#c17f59] px-8 py-3 font-body text-sm font-semibold text-[#0f0e0d]"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
