import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "./subscriptionStore";
import { hairScanLimitForPlan } from "./hairScanLimits";

export function currentHairScanPeriodKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getHairScanUsageForUser(
  admin: SupabaseClient,
  userId: string,
  periodKey = currentHairScanPeriodKey()
): Promise<number> {
  const { data, error } = await admin
    .from("hair_scan_usage")
    .select("scans_used")
    .eq("user_id", userId)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (error) throw error;
  return data?.scans_used ?? 0;
}

type ConsumeHairScanResult = {
  allowed: boolean;
  scans_used: number;
  scans_limit: number | null;
};

export async function consumeHairScanForUser(
  admin: SupabaseClient,
  userId: string,
  plan: Plan,
  periodKey = currentHairScanPeriodKey()
): Promise<ConsumeHairScanResult> {
  const limit = hairScanLimitForPlan(plan);

  const { data, error } = await admin.rpc("consume_hair_scan", {
    p_user_id: userId,
    p_period_key: periodKey,
    p_limit: limit,
  });

  if (error) throw error;

  const payload = data as ConsumeHairScanResult | null;
  if (!payload || typeof payload.allowed !== "boolean") {
    throw new Error("Invalid consume_hair_scan response");
  }

  return payload;
}
