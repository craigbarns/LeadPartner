import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion · LeadPartner" };

export default function LoginPage() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div className="micro text-muted-foreground">Connexion · #001</div>
        <h2 className="font-display text-5xl leading-[0.95] tracking-tightest">
          Bon <em className="italic">retour</em>.
        </h2>
        <p className="text-sm text-muted-foreground">
          Accédez à votre espace LeadPartner.
        </p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse bg-muted" />}>
        <LoginForm />
      </Suspense>
      <div className="border-t border-border pt-6 text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:no-underline px-1">
          Créer une entreprise →
        </Link>
      </div>
    </div>
  );
}
