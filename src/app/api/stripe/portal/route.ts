import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { createCustomerPortalSession } from "@/lib/stripe/portal";
import { isStripeEnabled } from "@/lib/env";

export async function POST() {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: "stripe_disabled" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("role", "company_admin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createServiceRoleClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", member.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "no_stripe_customer" }, { status: 422 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const url = await createCustomerPortalSession(sub.stripe_customer_id, `${baseUrl}/settings/billing`);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: "portal_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
