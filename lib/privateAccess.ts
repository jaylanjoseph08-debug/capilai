import { STORAGE_KEYS } from "./appConfig";

const UNLOCK_VALUE = "1";

export function getPrivateAccessCode(): string | undefined {
  return process.env.NEXT_PUBLIC_PRIVATE_ACCESS_CODE?.trim() || undefined;
}

export function isPrivateAccessConfigured(): boolean {
  return Boolean(getPrivateAccessCode());
}

export function hasPrivateAccess(): boolean {
  if (typeof window === "undefined") return false;
  if (!isPrivateAccessConfigured()) return false;
  try {
    return localStorage.getItem(STORAGE_KEYS.privateAccess) === UNLOCK_VALUE;
  } catch {
    return false;
  }
}

export function unlockPrivateAccess(code: string): boolean {
  const expected = getPrivateAccessCode();
  if (!expected || code.trim() !== expected) return false;
  if (typeof window === "undefined") return false;
  localStorage.setItem(STORAGE_KEYS.privateAccess, UNLOCK_VALUE);
  return true;
}

export function lockPrivateAccess(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.privateAccess);
}
