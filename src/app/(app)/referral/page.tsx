import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareButtons } from "./share";
import { PageHeader } from "@/components/app/page-header";
import { requireTenant } from "@/lib/auth";

export const metadata = { title: "Mon lien · LeadPartner" };

export default async function ReferralPage() {
  const session = await requireTenant();
  const code = session.membership?.referral_code ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link = `${baseUrl}/p/${session.tenant.slug}?ref=${code}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Mon lien apporteur"
        description={`Partagez ce lien pour recommander ${session.tenant.name}.`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mon code unique</CardTitle>
          <CardDescription>
            Toutes les opportunités créées via ce lien vous seront automatiquement attribuées.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <code className="flex-1 rounded-md bg-secondary px-4 py-3 font-mono text-sm break-all">
              {link}
            </code>
          </div>
          <ShareButtons link={link} code={code} tenantName={session.tenant.name} />
        </CardContent>
      </Card>
    </div>
  );
}
