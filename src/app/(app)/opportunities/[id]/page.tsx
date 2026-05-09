import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OpportunityStatusBadge } from "@/components/app/status-badge";
import { OpportunityStatusForm } from "./status-form";
import { OPPORTUNITY_STATUSES, statusLabel } from "@/lib/constants";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireTenant();
  const supabase = await createClient();

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!opportunity) notFound();

  const { data: history } = await supabase
    .from("opportunity_status_history")
    .select("id, from_status, to_status, note, created_at")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });

  const canEditStatus = session.role !== "referrer";
  const customFields = (opportunity.custom_fields ?? {}) as Record<string, string | number | boolean>;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Retour aux opportunités
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            {opportunity.prospect_name}
            <OpportunityStatusBadge status={opportunity.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            Créée le {formatDateTime(opportunity.created_at)}
          </p>
        </div>
        {opportunity.estimated_value !== null && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Valeur estimée</p>
            <p className="text-xl font-bold">{formatCurrency(Number(opportunity.estimated_value))}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Coordonnées du prospect</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {opportunity.prospect_name}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {opportunity.prospect_email ?? "—"}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {opportunity.prospect_phone ?? "—"}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {[opportunity.address, opportunity.city].filter(Boolean).join(" — ") || "—"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-line">
                {opportunity.description ?? "Aucune description fournie."}
              </p>
              {opportunity.comment && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Commentaire interne
                    </p>
                    <p className="whitespace-pre-line">{opportunity.comment}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {Object.keys(customFields).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informations spécifiques</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {Object.entries(customFields).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p>{String(value || "—")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des statuts</CardTitle>
            </CardHeader>
            <CardContent>
              {history && history.length ? (
                <ol className="relative border-l border-muted pl-5 space-y-4">
                  {history.map((h) => (
                    <li key={h.id}>
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                      <p className="text-sm">
                        {h.from_status ? (
                          <>
                            Passage de <strong>{statusLabel(h.from_status)}</strong> à{" "}
                            <strong>{statusLabel(h.to_status)}</strong>
                          </>
                        ) : (
                          <>
                            Statut initial : <strong>{statusLabel(h.to_status)}</strong>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.created_at)}
                      </p>
                      {h.note && <p className="text-xs mt-1">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun changement enregistré.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canEditStatus && (
            <OpportunityStatusForm
              opportunityId={opportunity.id}
              tenantId={session.tenant.id}
              currentStatus={opportunity.status}
              statuses={OPPORTUNITY_STATUSES}
              currentClosedValue={opportunity.closed_value}
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apporteur</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {opportunity.referrer_id ? (
                <>
                  <p className="text-muted-foreground text-xs">Référent</p>
                  <p>{opportunity.referrer_id}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Aucun apporteur associé.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
