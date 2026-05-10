"use server";

import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { createCustomerPortalSession } from "@/lib/stripe/portal";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isStripeEnabled } from "@/lib/env";

export async function startCheckout(plan: "starter" | "pro" | "business", cycle: "monthly" | "annual") {
  if (!isStripeEnabled()) {
    throw new Error("stripe_disabled");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("unauthorized");

  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("role", "company_admin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!member) throw new Error("forbidden");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = await createCheckoutSession({
    tenantId: member.tenant_id,
    adminEmail: user.email,
    plan,
    cycle,
    successUrl: `${baseUrl}/settings/billing?success=1`,
    cancelUrl: `${baseUrl}/settings/billing`,
  });
  redirect(url);
}

export async function openPortal() {
  if (!isStripeEnabled()) {
    throw new Error("stripe_disabled");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("role", "company_admin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!member) throw new Error("forbidden");

  const admin = createServiceRoleClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", member.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_customer_id) throw new Error("no_stripe_customer");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = await createCustomerPortalSession(sub.stripe_customer_id, `${baseUrl}/settings/billing`);
  redirect(url);
}
