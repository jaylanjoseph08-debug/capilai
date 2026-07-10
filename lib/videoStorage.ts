import { VIDEO_DB_NAME } from "./appConfig";

const DB_NAME = VIDEO_DB_NAME;
const DB_VERSION = 2;
const STORE = "videos";
const KEY = "latest";
const LEGACY_SESSION_KEYS = [
  "capilai-capture-video",
  "hairai-capture-video",
  "hairai-video-blob",
  "meche-capture-video",
] as const;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type CapturedVideoRecord = {
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  capturedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function recordFromBlob(blob: Blob): CapturedVideoRecord {
  return {
    blob,
    mimeType: blob.type || "video/webm",
    sizeBytes: blob.size,
    capturedAt: new Date().toISOString(),
  };
}

function parseLegacySessionValue(raw: string): Blob | null {
  try {
    const parsed = JSON.parse(raw) as { data?: string; mimeType?: string };
    if (parsed?.data && typeof parsed.data === "string") {
      const binary = atob(parsed.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: parsed.mimeType || "video/webm" });
    }
  } catch {
    // not JSON — try data URL
  }

  if (raw.startsWith("data:")) {
    const [header, base64] = raw.split(",");
    if (!base64) return null;
    const mime = header.match(/^data:([^;]+)/)?.[1] ?? "video/webm";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  return null;
}

async function migrateLegacySessionStorage(): Promise<CapturedVideoRecord | null> {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  for (const key of LEGACY_SESSION_KEYS) {
    const raw = sessionStorage.getItem(key);
    if (!raw) continue;

    const blob = parseLegacySessionValue(raw);
    sessionStorage.removeItem(key);
    if (!blob?.size) continue;

    await saveCapturedVideo(blob);
    return recordFromBlob(blob);
  }

  return null;
}

export async function saveCapturedVideo(blob: Blob): Promise<void> {
  if (!blob.size) {
    throw new Error("Cannot save an empty video");
  }
  if (blob.size > MAX_VIDEO_BYTES) {
    throw new Error("Video is too large (max 100 MB)");
  }

  const db = await openDb();
  const record = recordFromBlob(blob);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to save video"));
    };
    tx.objectStore(STORE).put(record, KEY);
  });
}

function normalizeRecord(value: unknown): CapturedVideoRecord | null {
  if (isBlob(value)) return recordFromBlob(value);
  if (value && typeof value === "object" && isBlob((value as CapturedVideoRecord).blob)) {
    return value as CapturedVideoRecord;
  }
  return null;
}

export async function loadCapturedVideo(): Promise<Blob | null> {
  const record = await loadCapturedVideoRecord();
  return record?.blob ?? null;
}

export async function loadCapturedVideoRecord(): Promise<CapturedVideoRecord | null> {
  try {
    const db = await openDb();
    const record = await new Promise<CapturedVideoRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(KEY);
      request.onerror = () => {
        db.close();
        reject(request.error ?? new Error("Failed to load video"));
      };
      request.onsuccess = () => {
        db.close();
        resolve(normalizeRecord(request.result));
      };
    });

    if (record) return record;
  } catch (error) {
    console.warn("[videoStorage] IndexedDB read failed:", error);
  }

  return migrateLegacySessionStorage();
}

export async function hasCapturedVideo(): Promise<boolean> {
  const record = await loadCapturedVideoRecord();
  return Boolean(record?.blob.size);
}

export async function clearCapturedVideo(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to clear video"));
    };
    tx.objectStore(STORE).delete(KEY);
  });
}
