const STORAGE_KEY = "capilai_pending_checkout_session";

export function savePendingCheckoutSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = sessionId.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}

export function getPendingCheckoutSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function clearPendingCheckoutSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
