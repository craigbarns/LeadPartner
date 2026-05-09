import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
  ];
  const isPublicPath =
    publicPaths.includes(pathname) ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/webhooks/");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Contract signature guard — block referrers without a signed contract
  // from accessing the (app) routes when the feature is enabled.
  const SIG_ENABLED = process.env.ENABLE_CONTRACT_SIGNATURE === "true";
  const APP_PATHS = [
    "/dashboard",
    "/referral",
    "/opportunities",
    "/commissions",
    "/account",
    "/program",
    "/referrers",
    "/settings",
    "/team",
  ];
  const SIG_BYPASS = [
    "/onboarding",
    "/sign",
    "/api",
    "/auth",
  ];

  const isAppPath = APP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isBypass = SIG_BYPASS.some((p) => pathname.startsWith(p));

  if (SIG_ENABLED && user && isAppPath && !isBypass) {
    const { data: members } = await supabase
      .from("tenant_members")
      .select(
        `id, role, tenant_id,
        profile:profiles!tenant_members_user_id_fkey(referrer_status)`,
      )
      .eq("user_id", user.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const referrer = (members as any[] | null)?.find((m) => m.role === "referrer");

    if (referrer) {
      const profile = referrer.profile;
      if (!profile?.referrer_status) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding/referrer";
        return NextResponse.redirect(url);
      }

      const { data: contract } = await supabase
        .from("contracts")
        .select("id, status")
        .eq("member_id", referrer.id)
        .in("status", ["draft", "pending_info", "sent", "signed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!contract) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding/referrer";
        return NextResponse.redirect(url);
      }

      if (contract.status !== "signed") {
        const url = request.nextUrl.clone();
        url.pathname = `/sign/${contract.id}`;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
