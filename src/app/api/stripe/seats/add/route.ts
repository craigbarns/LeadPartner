import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { addExtraSeat } from "@/lib/stripe/seats";
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

  try {
    const result = await addExtraSeat(member.tenant_id);

    const admin = createServiceRoleClient();
    await admin.from("seat_changes").insert({
      tenant_id: member.tenant_id,
      type: "add",
      changed_by: user.id,
      stripe_invoice_id: result.invoiceId,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "add_seat_failed", detail: (e as Error).message }, { status: 500 });
  }
}
