"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { AppRole } from "@/types/database";

type CustomField = {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "boolean";
  options: unknown;
  required: boolean;
};

export function OpportunityForm({
  tenantId,
  userId,
  role,
  customFields,
  programs = [],
}: {
  tenantId: string;
  userId: string;
  role: AppRole;
  customFields: CustomField[];
  programs?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [programId, setProgramId] = useState(() => programs[0]?.id ?? "");

  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [urgency, setUrgency] = useState<string>("medium");
  const [comment, setComment] = useState("");
  const [custom, setCustom] = useState<Record<string, string | number | boolean>>({});

  function setCustomValue(key: string, value: string | number | boolean) {
    setCustom((c) => ({ ...c, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!prospectName.trim()) {
      toast.error("Le nom du prospect est requis.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const payload = {
      tenant_id: tenantId,
      ...(programId ? { program_id: programId } : {}),
      prospect_name: prospectName.trim(),
      prospect_email: prospectEmail || null,
      prospect_phone: prospectPhone || null,
      city: city || null,
      address: address || null,
      description: description || null,
      estimated_value: estimatedValue ? Number(estimatedValue) : null,
      urgency: urgency || null,
      comment: comment || null,
      custom_fields: custom,
      referrer_id: role === "referrer" ? userId : null,
      status: "new" as const,
    };
    const { data, error } = await supabase
      .from("opportunities")
      .insert(payload)
      .select("id")
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Opportunité créée.");
    router.push(`/opportunities/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations du prospect</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.length > 0 && (
            <div className="space-y-2 md:col-span-2">
              <Label>Programme</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un programme" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Utilisé pour appliquer la bonne règle de commission en cas de vente.
              </p>
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="prospectName">Nom du prospect *</Label>
            <Input
              id="prospectName"
              required
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prospectEmail">Email</Label>
            <Input
              id="prospectEmail"
              type="email"
              value={prospectEmail}
              onChange={(e) => setProspectEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prospectPhone">Téléphone</Label>
            <Input
              id="prospectPhone"
              value={prospectPhone}
              onChange={(e) => setProspectPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description du besoin</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Précisez le besoin du prospect"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedValue">Valeur estimée (€)</Label>
            <Input
              id="estimatedValue"
              type="number"
              step="0.01"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Urgence</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Élevée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="comment">Commentaire</Label>
            <Textarea
              id="comment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Notes internes, contexte particulier..."
            />
          </div>
        </CardContent>
      </Card>

      {customFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Champs spécifiques à votre secteur</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customFields.map((field) => {
              const id = `cf_${field.key}`;
              const value = custom[field.key] ?? "";
              if (field.type === "select") {
                const opts = Array.isArray(field.options) ? field.options : [];
                return (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={id}>
                      {field.label}
                      {field.required && " *"}
                    </Label>
                    <Select
                      value={String(value)}
                      onValueChange={(v) => setCustomValue(field.key, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {(opts as string[]).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required && " *"}
                  </Label>
                  <Input
                    id={id}
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "date"
                          ? "date"
                          : "text"
                    }
                    required={field.required}
                    value={String(value)}
                    onChange={(e) =>
                      setCustomValue(
                        field.key,
                        field.type === "number" ? Number(e.target.value) : e.target.value,
                      )
                    }
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : "Créer l'opportunité"}
        </Button>
      </div>
    </form>
  );
}
