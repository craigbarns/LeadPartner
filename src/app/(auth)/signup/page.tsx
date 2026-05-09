import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Créer un compte · LeadPartner" };

export default function SignupPage() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div className="micro text-muted-foreground">Inscription · #002</div>
        <h2 className="font-display text-5xl leading-[0.95] tracking-tightest">
          Bienvenue. <em className="italic">Commençons.</em>
        </h2>
        <p className="text-sm text-muted-foreground">
          Quatorze jours d&apos;essai. Sans carte bancaire.
        </p>
      </div>
      <SignupForm />
      <div className="border-t border-border pt-6 text-sm text-muted-foreground">
        Vous avez déjà un compte ?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:no-underline px-1">
          Se connecter →
        </Link>
      </div>
    </div>
  );
}
