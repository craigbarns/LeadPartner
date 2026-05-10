import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Honor explicit `next` param if given
  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Otherwise route based on user's role + contract status
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const sigEnabled = process.env.ENABLE_CONTRACT_SIGNATURE === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await supabase
    .from("tenant_members")
    .select("id, role")
    .eq("user_id", user.id) as { data: any[] | null };

  // No memberships yet → user just confirmed via /signup, send to onboarding
  if (!members || members.length === 0) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  const isReferrer = members.some((m) => m.role === "referrer");
  if (sigEnabled && isReferrer) {
    return NextResponse.redirect(`${origin}/onboarding/referrer`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
