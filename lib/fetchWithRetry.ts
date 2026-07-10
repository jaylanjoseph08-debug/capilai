export type FetchWithRetryOptions = {
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { retries = 2, timeoutMs = 45_000, backoffMs = 800 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok || response.status < 500 || attempt === retries) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(`Request timed out after ${timeoutMs}ms`);
      } else {
        lastError = error instanceof Error ? error : new Error("Network error");
      }
    }

    if (attempt < retries) {
      await sleep(backoffMs * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Request failed");
}
