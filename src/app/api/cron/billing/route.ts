import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const { data: trials } = await admin
    .from("subscriptions")
    .select("tenant_id, trial_ends_at")
    .eq("status", "trialing")
    .gte("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", in7Days.toISOString());

  let sent = 0;
  for (const sub of trials ?? []) {
    if (!sub.trial_ends_at) continue;
    const daysLeft = Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86400000);
    if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
      console.log(`[cron] tenant ${sub.tenant_id} trial ends in ${daysLeft} day(s)`);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, scanned: trials?.length ?? 0, sent });
}
