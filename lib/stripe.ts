import type { Plan, BillingCycle } from "./subscriptionStore";
import { getAccessToken } from "./supabase/session";
import type {
  CheckoutRequestBody,
  CheckoutResponse,
  CheckoutSessionResponse,
  CheckoutErrorResponse,
} from "./stripe-types";

export type {
  CheckoutRequestBody,
  CheckoutResponse,
  CheckoutSuccessResponse,
  CheckoutErrorResponse,
  CheckoutSessionResponse,
} from "./stripe-types";
export { isCheckoutSuccess, isCheckoutSessionVerified } from "./stripe-types";

export type CheckoutResult = CheckoutResponse;

export async function startCheckout(plan: Plan, billingCycle: BillingCycle): Promise<CheckoutResult> {
  const payload: CheckoutRequestBody = { plan, billingCycle };
  const token = await getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as CheckoutResponse & { error?: string };

    if (!res.ok) {
      return {
        configured: res.status !== 501,
        error: data.error ?? `HTTP ${res.status}`,
        code: data.code ?? (res.status === 401 ? "AUTH_REQUIRED" : "CHECKOUT_FAILED"),
      };
    }

    return data;
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : "Network error",
      code: "NETWORK_ERROR",
    };
  }
}

export async function verifyCheckoutSession(
  sessionId: string
): Promise<CheckoutSessionResponse | CheckoutErrorResponse> {
  try {
    const res = await fetch(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`);
    const data = (await res.json()) as CheckoutSessionResponse | CheckoutErrorResponse;

    if (!res.ok) {
      const errorBody = data as CheckoutErrorResponse;
      return {
        configured: res.status !== 501,
        error: errorBody.error ?? `HTTP ${res.status}`,
        code: "SESSION_VERIFY_FAILED",
      };
    }

    return data;
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : "Network error",
      code: "NETWORK_ERROR",
    };
  }
}
