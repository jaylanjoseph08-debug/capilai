import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-radial px-6 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">404</p>
      <h1 className="mt-3 font-display text-2xl text-cream">Page not found</h1>
      <p className="mt-3 max-w-sm font-body text-sm text-muted">
        This page does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 flex h-12 items-center rounded-full bg-copper-gradient px-8 font-body text-sm font-semibold text-ink shadow-glow"
      >
        Back to home
      </Link>
    </main>
  );
}
