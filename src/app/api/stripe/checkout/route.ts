import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { isStripeEnabled } from "@/lib/env";

const BodySchema = z.object({
  plan: z.enum(["starter", "pro", "business"]),
  cycle: z.enum(["monthly", "annual"]),
});

export async function POST(req: Request) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: "stripe_disabled" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const url = await createCheckoutSession({
      tenantId: member.tenant_id,
      adminEmail: user.email ?? "",
      plan: parsed.data.plan,
      cycle: parsed.data.cycle,
      successUrl: `${baseUrl}/settings/billing?success=1`,
      cancelUrl: `${baseUrl}/settings/billing`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: "checkout_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
