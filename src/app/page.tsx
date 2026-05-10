import Link from "next/link";
import { ArrowUpRight, Asterisk } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INDUSTRIES, PLANS } from "@/lib/constants";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground grain">
      {/* Top bar */}
      <header className="relative z-10 border-b border-border/70">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-5 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-7 w-7 bg-foreground" />
              <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 bg-accent" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-xl">LeadPartner</span>
              <span className="micro text-muted-foreground mt-0.5">
                · est. 2026
              </span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="#produit" className="hover:text-accent-foreground hover:bg-accent px-1 transition-colors">
              Produit
            </a>
            <a href="#secteurs" className="hover:text-accent-foreground hover:bg-accent px-1 transition-colors">
              Secteurs
            </a>
            <a href="#tarifs" className="hover:text-accent-foreground hover:bg-accent px-1 transition-colors">
              Tarifs
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-none">
              <Link href="/login">Connexion</Link>
            </Button>
            <Button asChild size="sm" className="rounded-none">
              <Link href="/signup" className="flex items-center gap-1.5">
                Démarrer <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-12 pb-20 lg:pt-20 lg:pb-32">
          <div className="grid grid-cols-12 gap-6 lg:gap-10">
            {/* Marker / index */}
            <div className="col-span-12 lg:col-span-2 flex lg:flex-col items-baseline lg:items-start gap-4 lg:gap-2 reveal">
              <div className="micro text-muted-foreground">Index 01</div>
              <div className="hidden lg:block w-12 h-px bg-foreground my-3" />
              <div className="micro text-muted-foreground">
                Programmes <br className="hidden lg:block" /> d&apos;apporteurs
              </div>
            </div>

            {/* Headline */}
            <div className="col-span-12 lg:col-span-10 reveal" style={{ animationDelay: "60ms" }}>
              <h1 className="font-display text-[14vw] sm:text-7xl lg:text-[9rem] xl:text-[10.5rem] leading-[0.92] tracking-tightest">
                <span>L&apos;infrastructure</span>
                <br />
                <span>
                  <em className="italic font-display">tranquille</em>
                </span>
                <br />
                <span>
                  pour vos apporteurs
                  <Asterisk className="inline-block h-12 w-12 lg:h-20 lg:w-20 text-accent ml-2 align-middle" />
                </span>
              </h1>
              <div className="mt-10 grid grid-cols-12 gap-6 lg:gap-10">
                <div className="col-span-12 lg:col-span-4 lg:col-start-7">
                  <p className="text-base lg:text-lg leading-relaxed">
                    Recrutez, attribuez, suivez et rémunérez vos apporteurs
                    d&apos;affaires depuis un seul outil. Sans tableur. Sans email
                    perdu. Sans tableau de bord violet.
                  </p>
                </div>
                <div className="col-span-12 lg:col-span-2 flex flex-col gap-3">
                  <Button asChild className="rounded-none h-12 px-6 group">
                    <Link href="/signup" className="flex items-center justify-between gap-2">
                      <span>Démarrer 14 jours</span>
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-none h-12 px-6">
                    <Link href="#produit">Voir le produit</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="border-y border-border bg-background">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
            {[
              { kpi: "12", label: "statuts d'opportunité" },
              { kpi: "8", label: "secteurs préconfigurés" },
              { kpi: "3", label: "modèles de commission" },
              { kpi: "∞", label: "isolation par tenant" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`px-6 py-8 lg:py-10 ${i === 0 ? "pl-6 lg:pl-0" : ""}`}
              >
                <div className="font-display text-5xl lg:text-7xl tabular tracking-tightest">
                  {s.kpi}
                </div>
                <div className="micro text-muted-foreground mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product breakdown */}
      <section id="produit" className="py-24 lg:py-32">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-12 gap-6 lg:gap-10 mb-16">
            <div className="col-span-12 lg:col-span-3">
              <div className="micro text-muted-foreground mb-3">§ 02 — Produit</div>
              <h2 className="font-display text-5xl lg:text-6xl leading-[0.95] tracking-tightest">
                Quatre <em className="italic">salles</em>, un seul bâtiment.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-6 lg:col-start-7 mt-2">
              <p className="text-base text-muted-foreground leading-relaxed">
                LeadPartner segmente l&apos;expérience par rôle. Le super admin
                administre les locataires. L&apos;administrateur entreprise pilote
                son programme. Le collaborateur traite les opportunités.
                L&apos;apporteur déclare et suit ses commissions. Chacun voit
                strictement ce qu&apos;il doit voir, garanti par le Row Level
                Security de Supabase.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-px bg-border border border-border">
            {[
              {
                num: "01",
                title: "Recruter",
                body: "Page publique d'inscription, lien personnel et code de parrainage généré à l'arrivée. Activation en un toggle.",
                accent: false,
              },
              {
                num: "02",
                title: "Qualifier",
                body: "Champs spécifiques au secteur, urgence, valeur estimée. Attribution à un collaborateur en un clic.",
                accent: false,
              },
              {
                num: "03",
                title: "Suivre",
                body: "Douze statuts par défaut, audit trail automatique, notes internes. L'historique reste lisible un an plus tard.",
                accent: true,
              },
              {
                num: "04",
                title: "Rémunérer",
                body: "Règles fixes, en pourcentage ou par paliers. Validation explicite avant paiement. Tableau exportable.",
                accent: false,
              },
            ].map((card) => (
              <article
                key={card.num}
                className={`col-span-12 md:col-span-6 lg:col-span-3 p-6 lg:p-8 bg-card group transition-colors hover:bg-foreground hover:text-background ${
                  card.accent ? "" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-12 lg:mb-20">
                  <span className="font-mono text-xs tabular text-muted-foreground group-hover:text-background/60">
                    {card.num} / 04
                  </span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <h3 className="font-display text-3xl lg:text-4xl tracking-tightest mb-3">
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground group-hover:text-background/70">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="secteurs" className="py-24 lg:py-32 border-t border-border bg-secondary/40">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-12 gap-6 lg:gap-10 mb-12">
            <div className="col-span-12 lg:col-span-6">
              <div className="micro text-muted-foreground mb-3">§ 03 — Secteurs</div>
              <h2 className="font-display text-5xl lg:text-6xl leading-[0.95] tracking-tightest">
                Préconfiguré pour <em className="italic">votre métier</em>.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-5 lg:col-start-8 self-end">
              <p className="text-muted-foreground">
                À l&apos;onboarding, choisissez votre secteur. Les champs spécifiques
                (type de bien, surface, sujet de formation, type d&apos;assurance…)
                sont injectés automatiquement. Modifiables ensuite.
              </p>
            </div>
          </div>
          <div className="border-t border-border">
            {INDUSTRIES.map((industry, i) => (
              <Link
                key={industry.value}
                href="/signup"
                className="group flex items-center justify-between gap-6 border-b border-border py-6 lg:py-7 hover:bg-foreground hover:text-background transition-colors px-2 -mx-2"
              >
                <div className="flex items-center gap-6 lg:gap-10">
                  <span className="font-mono text-xs tabular text-muted-foreground group-hover:text-background/60 w-8">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-2xl lg:text-3xl">{industry.emoji}</span>
                  <span className="font-display text-3xl lg:text-5xl tracking-tightest">
                    {industry.label}
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 lg:h-6 lg:w-6 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="py-24 lg:py-32 border-t border-border">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-12 gap-6 lg:gap-10 mb-12">
            <div className="col-span-12 lg:col-span-6">
              <div className="micro text-muted-foreground mb-3">§ 04 — Tarifs</div>
              <h2 className="font-display text-5xl lg:text-6xl leading-[0.95] tracking-tightest">
                Trois plans, sans surprise.
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-px border border-border bg-border">
            {PLANS.map((plan, idx) => {
              const featured = idx === 1;
              return (
                <div
                  key={plan.value}
                  className={`col-span-12 md:col-span-4 p-8 lg:p-10 ${
                    featured ? "bg-foreground text-background" : "bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <div className="micro text-muted-foreground mb-1">
                        {featured ? "Le plus choisi" : `Plan ${idx + 1}`}
                      </div>
                      <h3 className="font-display text-4xl tracking-tightest">{plan.label}</h3>
                    </div>
                    {featured && (
                      <div className="h-10 w-10 bg-accent text-accent-foreground flex items-center justify-center font-mono text-xs">
                        ★
                      </div>
                    )}
                  </div>
                  <div className="mb-10">
                    <span className="font-display text-7xl tabular tracking-tightest">
                      {plan.monthly_price}
                      <span className="text-3xl">€</span>
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">/ mois</span>
                  </div>
                  <ul className="space-y-3 mb-10">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-baseline gap-3 text-sm border-b border-border/40 pb-3 last:border-0"
                      >
                        <span
                          className={`font-mono text-[10px] tabular ${
                            featured ? "text-background/60" : "text-muted-foreground"
                          }`}
                        >
                          ↳
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={featured ? "default" : "outline"}
                    className={`rounded-none h-12 w-full ${
                      featured
                        ? "bg-accent text-accent-foreground hover:bg-accent/90"
                        : ""
                    }`}
                  >
                    <Link href="/signup" className="flex items-center justify-between">
                      <span>{plan.cta}</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closer */}
      <section className="py-24 lg:py-40 border-t border-border bg-foreground text-background relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-12 gap-6 lg:gap-10 items-end">
            <div className="col-span-12 lg:col-span-9">
              <h2 className="font-display text-6xl md:text-8xl lg:text-[10rem] leading-[0.9] tracking-tightest">
                Il est temps <br />
                <em className="italic">d&apos;arrêter</em> les tableurs.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
              <Button asChild size="lg" className="rounded-none h-14 bg-accent text-accent-foreground hover:bg-accent/90">
                <Link href="/signup" className="flex items-center justify-between w-full">
                  Démarrer maintenant <ArrowUpRight className="h-5 w-5" />
                </Link>
              </Button>
              <p className="micro text-background/50">
                Essai 14 jours · sans CB
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background border-t border-background/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-6">
            <div className="font-display text-2xl">LeadPartner</div>
            <p className="micro text-background/50 mt-1">© {new Date().getFullYear()} — tous droits réservés</p>
          </div>
          <div className="col-span-6 md:col-span-3 flex flex-col gap-2 text-sm text-background/70">
            <span className="micro text-background/40 mb-1">Produit</span>
            <Link href="#produit" className="hover:text-accent">Modules</Link>
            <Link href="#secteurs" className="hover:text-accent">Secteurs</Link>
            <Link href="#tarifs" className="hover:text-accent">Tarifs</Link>
          </div>
          <div className="col-span-6 md:col-span-3 flex flex-col gap-2 text-sm text-background/70">
            <span className="micro text-background/40 mb-1">Compte</span>
            <Link href="/login" className="hover:text-accent">Connexion</Link>
            <Link href="/signup" className="hover:text-accent">Inscription</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
