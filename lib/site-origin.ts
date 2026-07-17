import type { NextRequest } from "next/server";

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;
const VERCEL_APP_HOST = "capil-ai.vercel.app";
const PRODUCTION_HOST = "capilai.app";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return LOCAL_HOST_RE.test(hostname);
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/** Prefer the custom domain over the default *.vercel.app deployment host. */
function canonicalizeHost(host: string): string {
  const bare = host.split(":")[0]?.toLowerCase() ?? host;
  if (bare === VERCEL_APP_HOST || bare.endsWith(".vercel.app")) {
    return PRODUCTION_HOST;
  }
  return bare;
}

/**
 * Public origin for Stripe Checkout success/cancel URLs.
 * On Vercel, never fall back to localhost even if NEXT_PUBLIC_SITE_URL is mis-set.
 */
export function resolveCheckoutOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  if (fromEnv && /^https?:\/\//.test(fromEnv) && !(isProd && isLocalUrl(fromEnv))) {
    try {
      const parsed = new URL(fromEnv);
      parsed.hostname = canonicalizeHost(parsed.hostname);
      return stripTrailingSlash(parsed.origin);
    } catch {
      // fall through
    }
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host") || "";
  if (host && !LOCAL_HOST_RE.test(host.split(":")[0] ?? host)) {
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (isProd ? "https" : req.nextUrl.protocol.replace(":", "") || "https");
    return `${proto}://${canonicalizeHost(host)}`;
  }

  const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProdUrl) {
    const hostOnly = vercelProdUrl.replace(/^https?:\/\//, "");
    return `https://${canonicalizeHost(hostOnly)}`;
  }

  if (fromEnv && /^https?:\/\//.test(fromEnv)) {
    return stripTrailingSlash(fromEnv);
  }

  return stripTrailingSlash(req.nextUrl.origin);
}
