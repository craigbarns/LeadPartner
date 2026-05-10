"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveSubscription,
  SubscriptionGuardError,
} from "@/lib/auth/require-active-subscription";
import type { AppRole } from "@/types/database";

export type CreateInvitationResult =
  | { ok: true; token: string }
  | { ok: false; needsUpgrade: true }
  | { ok: false; error: string };

export async function createInvitation(input: {
  email: string;
  role: Exclude<AppRole, "super_admin">;
  tenantId: string;
  userId: string;
}): Promise<CreateInvitationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (user.id !== input.userId) return { ok: false, error: "forbidden" };

  const { data: caller } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("tenant_id", input.tenantId)
    .eq("role", "company_admin")
    .maybeSingle();
  if (!caller || caller.tenant_id !== input.tenantId) return { ok: false, error: "forbidden" };

  try {
    await requireActiveSubscription(caller.tenant_id);
  } catch (e) {
    if (e instanceof SubscriptionGuardError) {
      return { ok: false, error: `subscription_${e.reason}` };
    }
    throw e;
  }

  if (input.role === "company_admin" || input.role === "collaborator") {
    const { data: remaining, error: rpcError } = await supabase.rpc("seats_remaining", {
      t: caller.tenant_id,
    });
    if (rpcError) return { ok: false, error: rpcError.message };
    if ((remaining as number | null) === 0) {
      return { ok: false, needsUpgrade: true };
    }
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      tenant_id: input.tenantId,
      email: input.email.toLowerCase().trim(),
      role: input.role,
      token,
      expires_at: expiresAt,
      invited_by: input.userId,
    })
    .select("token")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/team/invite");
  return { ok: true, token: data.token };
}
