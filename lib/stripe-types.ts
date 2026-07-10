import type { Plan, BillingCycle } from "./subscriptionStore";

export type CheckoutRequestBody = {
  plan: Plan;
  billingCycle: BillingCycle;
};

export type CheckoutSuccessResponse = {
  configured: true;
  url: string;
  sessionId: string;
};

export type CheckoutErrorResponse = {
  configured: boolean;
  error: string;
  code?: string;
};

export type CheckoutResponse = CheckoutSuccessResponse | CheckoutErrorResponse;

export type CheckoutSessionResponse = {
  configured: true;
  plan: Plan;
  billingCycle: BillingCycle;
  sessionId: string;
};

export function isCheckoutSuccess(data: CheckoutResponse): data is CheckoutSuccessResponse {
  return data.configured === true && "url" in data && typeof data.url === "string";
}

export function isCheckoutSessionVerified(
  data: CheckoutSessionResponse | CheckoutErrorResponse
): data is CheckoutSessionResponse {
  return data.configured === true && "plan" in data && "billingCycle" in data;
}
