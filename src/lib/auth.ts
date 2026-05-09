import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export type SessionContext = {
  user: { id: string; email: string };
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    is_super_admin: boolean;
  };
  membership: {
    tenant_id: string;
    role: Exclude<AppRole, "super_admin">;
    referral_code: string | null;
  } | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    industry: string;
    logo_url: string | null;
    primary_color: string | null;
    subscription_plan: string;
    subscription_status: string;
  } | null;
  role: AppRole;
};

export async function getSession(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,avatar_url,is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  if (profile.is_super_admin) {
    return {
      user: { id: user.id, email: user.email ?? profile.email },
      profile,
      membership: null,
      tenant: null,
      role: "super_admin",
    };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id, role, referral_code, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      user: { id: user.id, email: user.email ?? profile.email },
      profile,
      membership: null,
      tenant: null,
      role: "company_admin",
    };
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "id,name,slug,industry,logo_url,primary_color,subscription_plan,subscription_status",
    )
    .eq("id", membership.tenant_id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email ?? profile.email },
    profile,
    membership: {
      tenant_id: membership.tenant_id,
      role: membership.role as Exclude<AppRole, "super_admin">,
      referral_code: membership.referral_code,
    },
    tenant: tenant ?? null,
    role: membership.role as AppRole,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireTenant(): Promise<SessionContext & { tenant: NonNullable<SessionContext["tenant"]> }> {
  const session = await requireSession();
  if (session.role === "super_admin") redirect("/super-admin");
  if (!session.tenant) redirect("/onboarding");
  return session as SessionContext & { tenant: NonNullable<SessionContext["tenant"]> };
}

export async function requireRole(roles: AppRole[]): Promise<SessionContext> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    redirect("/dashboard");
  }
  return session;
}
