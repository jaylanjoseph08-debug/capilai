import { NextResponse } from "next/server";

export type ApiErrorBody = {
  configured: boolean;
  error?: string;
  code?: string;
};

export function apiError(
  message: string,
  status: number,
  options: { configured?: boolean; code?: string } = {}
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      configured: options.configured ?? true,
      error: message,
      code: options.code,
    },
    { status }
  );
}

export function apiNotConfigured(message = "Service not configured"): NextResponse<ApiErrorBody> {
  return NextResponse.json({ configured: false, error: message }, { status: 501 });
}

export function parseJsonBody<T>(body: unknown, requiredKeys: (keyof T)[]): T | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (record[key as string] === undefined || record[key as string] === null) return null;
  }
  return record as T;
}
