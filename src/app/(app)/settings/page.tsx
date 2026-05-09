import Link from "next/link";
import { CreditCard, Image as ImageIcon, Palette, Sliders } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth";

const SECTIONS = [
  {
    href: "/settings/branding",
    title: "Branding & identité",
    description: "Logo, couleur principale, nom affiché",
    icon: Palette,
  },
  {
    href: "/settings/commissions",
    title: "Règles de commission",
    description: "Fixe, pourcentage, paliers, base de calcul",
    icon: CreditCard,
  },
  {
    href: "/settings/fields",
    title: "Champs personnalisés",
    description: "Champs spécifiques à votre secteur d'activité",
    icon: Sliders,
  },
  {
    href: "/settings/billing",
    title: "Plan & facturation",
    description: "Abonnement, prochaines échéances",
    icon: ImageIcon,
  },
];

export const metadata = { title: "Paramètres · LeadPartner" };

export default async function SettingsPage() {
  await requireRole(["company_admin", "super_admin"]);
  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" description="Configurez votre espace LeadPartner." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full hover:border-primary/40 transition-colors">
                <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
