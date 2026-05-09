"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INDUSTRIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { cn, slugify } from "@/lib/utils";
import type { IndustryCode } from "@/types/database";

const STEPS = [
  { num: "01", title: "Entreprise", caption: "Identité" },
  { num: "02", title: "Secteur", caption: "Métier" },
  { num: "03", title: "Identité", caption: "Branding" },
  { num: "04", title: "Confirmation", caption: "Création" },
];

export function OnboardingWizard({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [industry, setIndustry] = useState<IndustryCode>("real_estate");
  const [primaryColor, setPrimaryColor] = useState("#1F1B17");

  function next() {
    if (step === 0 && !companyName.trim()) {
      toast.error("Le nom de l'entreprise est requis.");
      return;
    }
    if (step === 0 && !slug) setSlug(slugify(companyName));
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function prev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setLoading(true);
    const supabase = createClient();
    const finalSlug = slug || slugify(companyName);
    const { data, error } = await supabase.rpc("create_tenant", {
      p_name: companyName.trim(),
      p_slug: finalSlug,
      p_industry: industry,
      p_primary_color: primaryColor,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Votre espace est prêt.");
    router.push("/dashboard");
    router.refresh();
    return data;
  }

  return (
    <div className="border border-border bg-card">
      {/* Step header */}
      <header className="border-b border-border p-6 lg:p-8">
        <div className="flex items-center justify-between gap-6 mb-6">
          <div>
            <div className="micro text-muted-foreground">{userEmail}</div>
            <h1 className="font-display text-3xl lg:text-4xl tracking-tightest mt-2">
              Configurer votre <em className="italic">espace</em>
            </h1>
          </div>
          <div className="font-mono text-xs tabular text-muted-foreground hidden sm:block">
            {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
          </div>
        </div>
        <ol className="grid grid-cols-4 border-t border-border -mx-6 lg:-mx-8 -mb-6 lg:-mb-8">
          {STEPS.map((s, i) => (
            <li
              key={s.num}
              className={cn(
                "px-4 lg:px-6 py-3 border-r border-border last:border-r-0 flex flex-col gap-0.5 relative",
                i === step && "bg-foreground text-background",
                i < step && "text-muted-foreground",
              )}
            >
              {i === step && <span className="absolute left-0 top-0 right-0 h-0.5 bg-accent" />}
              <span className="micro opacity-60">{s.num}</span>
              <span className="text-sm font-medium">{s.title}</span>
            </li>
          ))}
        </ol>
      </header>

      {/* Content */}
      <div className="p-6 lg:p-10 min-h-[420px]">
        {step === 0 && (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="font-display text-3xl lg:text-4xl tracking-tightest">
                Comment s&apos;appelle votre <em className="italic">entreprise</em>?
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Vous pourrez la modifier ensuite dans les paramètres.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName" className="micro">Nom légal</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="ACME Immobilier"
                className="rounded-none h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug" className="micro">Identifiant URL</Label>
              <div className="flex items-stretch border border-input">
                <span className="flex items-center px-3 bg-secondary text-sm text-muted-foreground font-mono">
                  leadpartner.app/p/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="acme-immo"
                  className="rounded-none h-12 border-0 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-3xl lg:text-4xl tracking-tightest">
                Quel est votre <em className="italic">secteur</em>?
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Nous précharterons les champs adaptés.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border">
              {INDUSTRIES.map((i) => (
                <button
                  key={i.value}
                  onClick={() => setIndustry(i.value)}
                  type="button"
                  className={cn(
                    "p-5 text-left bg-card transition-colors flex flex-col gap-3 group",
                    industry === i.value
                      ? "bg-foreground text-background"
                      : "hover:bg-secondary",
                  )}
                >
                  <div className="text-3xl">{i.emoji}</div>
                  <div className="text-sm font-medium leading-tight">{i.label}</div>
                  <div
                    className={cn(
                      "h-1 w-6 transition-all",
                      industry === i.value ? "bg-accent w-12" : "bg-border",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="font-display text-3xl lg:text-4xl tracking-tightest">
                Quelle est votre <em className="italic">couleur</em>?
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Elle apparaîtra sur la page publique et les boutons clés.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor" className="micro">Couleur principale</Label>
              <div className="flex items-stretch border border-input">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-12 w-16 cursor-pointer bg-transparent"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="rounded-none h-12 border-0 font-mono"
                />
              </div>
            </div>
            <div className="border border-border bg-secondary/40 p-5 flex items-center gap-4">
              <div className="relative">
                <div
                  className="h-14 w-14 flex items-center justify-center text-white font-display text-2xl"
                  style={{ background: primaryColor }}
                >
                  {companyName?.[0]?.toUpperCase() ?? "L"}
                </div>
                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-accent" />
              </div>
              <div>
                <p className="font-display text-xl">{companyName || "Mon entreprise"}</p>
                <p className="micro text-muted-foreground mt-0.5">Aperçu du branding</p>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-3xl lg:text-4xl tracking-tightest">
                Tout est <em className="italic">prêt</em>.
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Vérifiez les informations puis créez votre espace.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
              {[
                { label: "Entreprise", value: companyName },
                { label: "Identifiant", value: slug, mono: true },
                {
                  label: "Secteur",
                  value: INDUSTRIES.find((i) => i.value === industry)?.label,
                },
                {
                  label: "Couleur",
                  value: primaryColor,
                  mono: true,
                  swatch: primaryColor,
                },
              ].map((row) => (
                <div key={row.label} className="bg-card p-5">
                  <div className="micro text-muted-foreground mb-1">{row.label}</div>
                  <div className="flex items-center gap-2">
                    {row.swatch && (
                      <span
                        className="inline-block h-4 w-4 border border-border"
                        style={{ background: row.swatch }}
                      />
                    )}
                    <span className={row.mono ? "font-mono text-sm" : "font-medium"}>
                      {row.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <ul className="space-y-2 border-l-2 border-accent pl-4">
              {[
                "Programme d'apporteurs créé par défaut",
                "Champs adaptés à votre secteur",
                "Règle de commission par défaut (5%)",
                "14 jours d'essai gratuit",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <footer className="flex items-center justify-between gap-3 px-6 lg:px-8 py-5 border-t border-border bg-secondary/30">
        <Button
          variant="ghost"
          onClick={prev}
          disabled={step === 0}
          className="rounded-none"
        >
          <ArrowLeft className="h-4 w-4" /> Précédent
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} className="rounded-none h-11 px-6">
            Suivant <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={loading} className="rounded-none h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? "Création..." : "Créer mon espace"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </footer>
    </div>
  );
}
