import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Asterisk, BadgeCheck } from "lucide-react";
import { ReferrerSignupForm } from "./signup-form";
import { INDUSTRIES } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServiceClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  return {
    title: tenant ? `Devenir apporteur ${tenant.name}` : "Programme apporteurs",
  };
}

export default async function PublicProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const supabase = await createServiceClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, primary_color, logo_url, industry")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) notFound();

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, description, terms, public_signup_enabled")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!program?.public_signup_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background grain">
        <div className="max-w-md w-full border border-border bg-card p-8 relative z-10">
          <div className="micro text-muted-foreground mb-2">Programme privé</div>
          <h1 className="font-display text-3xl tracking-tightest mb-3">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">
            {tenant.name} n&apos;a pas activé l&apos;inscription publique. Contactez votre
            référent pour obtenir un lien d&apos;invitation.
          </p>
        </div>
      </div>
    );
  }

  const industryLabel = INDUSTRIES.find((i) => i.value === tenant.industry)?.label;
  const industryEmoji = INDUSTRIES.find((i) => i.value === tenant.industry)?.emoji;

  return (
    <div className="min-h-screen bg-background grain">
      {/* Hero */}
      <header
        className="relative overflow-hidden text-background"
        style={{ background: tenant.primary_color ?? "hsl(var(--foreground))" }}
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6 lg:px-10 pt-10 pb-20 lg:pb-32">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity">
            ← LeadPartner
          </Link>
          <div className="mt-12 grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-9">
              <div className="micro text-background/50 mb-6">
                Programme officiel · {industryEmoji} {industryLabel}
              </div>
              <h1 className="font-display text-5xl md:text-7xl lg:text-[7rem] leading-[0.92] tracking-tightest">
                Devenez <em className="italic">apporteur</em>
                <Asterisk className="inline-block h-10 w-10 lg:h-16 lg:w-16 text-accent ml-1 align-middle" />
                <br />
                pour {tenant.name}.
              </h1>
              <p className="text-background/70 mt-8 max-w-xl text-base lg:text-lg leading-relaxed">
                {program.description ??
                  `Recommandez ${tenant.name} et soyez rémunéré pour chaque opportunité concrétisée.`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-16 grid grid-cols-12 gap-6 lg:gap-10">
        {/* Comment ça marche */}
        <section className="col-span-12 lg:col-span-7">
          <div className="micro text-muted-foreground mb-3">§ Comment ça marche</div>
          <h2 className="font-display text-4xl lg:text-5xl tracking-tightest leading-[0.95] mb-10">
            Quatre étapes. <em className="italic">Pas une de plus.</em>
          </h2>
          <ol className="border-t border-border">
            {[
              { step: "01", title: "Inscription", body: "Renseignez vos coordonnées via le formulaire." },
              { step: "02", title: "Activation", body: "Recevez votre lien personnel et code de parrainage." },
              { step: "03", title: "Recommandation", body: "Partagez avec vos contacts et déclarez les opportunités." },
              { step: "04", title: "Rémunération", body: "Suivez vos commissions estimées, dues et payées." },
            ].map((s) => (
              <li
                key={s.step}
                className="border-b border-border py-6 flex items-start gap-6 group"
              >
                <span
                  className="font-mono text-xs tabular text-muted-foreground mt-1.5"
                  style={{ color: tenant.primary_color ?? undefined }}
                >
                  {s.step}
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-2xl tracking-tightest">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {program.terms && (
            <div className="mt-12 border border-border bg-secondary/30 p-6">
              <div className="flex items-center gap-2 mb-3">
                <BadgeCheck className="h-4 w-4" />
                <h3 className="font-display text-xl tracking-tightest">Conditions du programme</h3>
              </div>
              <pre className="whitespace-pre-line text-sm font-sans text-muted-foreground leading-relaxed">{program.terms}</pre>
            </div>
          )}
        </section>

        {/* Form */}
        <aside className="col-span-12 lg:col-span-5 lg:sticky lg:top-6 self-start">
          <div className="border border-border bg-card">
            <header className="flex items-center justify-between p-5 lg:p-6 border-b border-border">
              <div>
                <div className="micro text-muted-foreground">Inscription</div>
                <h3 className="font-display text-2xl tracking-tightest mt-1">
                  Devenir apporteur
                </h3>
              </div>
              <ArrowUpRight className="h-5 w-5" />
            </header>
            <div className="p-5 lg:p-6">
              <ReferrerSignupForm
                tenantId={tenant.id}
                tenantName={tenant.name}
                programId={program.id}
                referralCode={ref ?? null}
                primaryColor={tenant.primary_color ?? null}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
