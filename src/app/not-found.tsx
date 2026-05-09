import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
      <div className="text-center space-y-4 max-w-md">
        <p className="text-sm text-muted-foreground">Erreur 404</p>
        <h1 className="text-3xl font-bold">Page introuvable</h1>
        <p className="text-muted-foreground">
          Ce que vous cherchez a été déplacé ou n&apos;existe pas.
        </p>
        <Button asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </div>
  );
}
