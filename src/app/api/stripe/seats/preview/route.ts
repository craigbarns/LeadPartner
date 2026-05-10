import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewSeatAddition } from "@/lib/stripe/seats";
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
    const preview = await previewSeatAddition(member.tenant_id);
    return NextResponse.json(preview);
  } catch (e) {
    return NextResponse.json({ error: "preview_failed", detail: (e as Error).message }, { status: 422 });
  }
}
