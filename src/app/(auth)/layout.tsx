import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* Editorial column */}
      <div className="relative hidden lg:flex flex-col justify-between bg-foreground text-background p-12 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <div className="relative">
            <div className="h-7 w-7 bg-background" />
            <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 bg-accent" />
          </div>
          <span className="font-display text-2xl">LeadPartner</span>
        </Link>

        <div className="relative z-10 max-w-xl">
          <div className="micro text-background/40 mb-6">§ Programme</div>
          <h1 className="font-display text-6xl xl:text-7xl leading-[0.95] tracking-tightest">
            Une <em className="italic">infrastructure</em> pour vos
            apporteurs<span className="text-accent">.</span>
          </h1>
          <p className="text-background/60 mt-8 text-base leading-relaxed">
            Recrutement, qualification, attribution, paiement. Quatre verbes,
            un seul outil. Gardez vos tableurs pour vos rapports trimestriels.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6 border-t border-background/10 pt-6">
          {[
            { v: "14j", k: "essai gratuit" },
            { v: "RLS", k: "isolation native" },
            { v: "SaaS", k: "multi-tenant" },
          ].map((s) => (
            <div key={s.k}>
              <div className="font-display text-3xl tabular tracking-tightest">{s.v}</div>
              <div className="micro text-background/40 mt-1">{s.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form column */}
      <div className="flex items-center justify-center p-6 lg:p-12 grain">
        <div className="w-full max-w-md relative z-10">{children}</div>
      </div>
    </div>
  );
}
