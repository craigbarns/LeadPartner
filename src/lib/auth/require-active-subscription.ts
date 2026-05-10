import type { SubscriptionStatus } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export interface SubscriptionStateForGuard {
  status: SubscriptionStatus;
  trial_ends_at: string | null;
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "trial_expired" | "subscription_inactive" | "no_subscription" };

export function evaluateSubscriptionAccess(sub: SubscriptionStateForGuard | null): AccessDecision {
  if (!sub) return { allowed: false, reason: "no_subscription" };
  if (sub.status === "active") return { allowed: true };
  if (sub.status === "past_due") return { allowed: true };
  if (sub.status === "trialing") {
    if (!sub.trial_ends_at) return { allowed: true };
    const expired = new Date(sub.trial_ends_at) < new Date();
    return expired ? { allowed: false, reason: "trial_expired" } : { allowed: true };
  }
  return { allowed: false, reason: "subscription_inactive" };
}

export class SubscriptionGuardError extends Error {
  constructor(public reason: "trial_expired" | "subscription_inactive" | "no_subscription") {
    super(reason);
  }
}

export async function requireActiveSubscription(tenantId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const decision = evaluateSubscriptionAccess(data ?? null);
  if (!decision.allowed) throw new SubscriptionGuardError(decision.reason);
}
