"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type Program = {
  id: string;
  name: string;
  description: string | null;
  terms: string | null;
  public_signup_enabled: boolean;
  slug: string;
};

export function ProgramSettingsForm({
  tenantId,
  program,
  publicSlug,
}: {
  tenantId: string;
  program: Program;
  publicSlug: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description ?? "");
  const [terms, setTerms] = useState(program.terms ?? "");
  const [publicEnabled, setPublicEnabled] = useState(program.public_signup_enabled);
  const [loading, setLoading] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("programs")
      .update({
        name,
        description: description || null,
        terms: terms || null,
        public_signup_enabled: publicEnabled,
      })
      .eq("id", program.id)
      .eq("tenant_id", tenantId);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Programme mis à jour.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Paramètres du programme</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du programme</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description publique</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Devenez apporteur d'affaires et gagnez X% de commission..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Conditions</Label>
            <Textarea
              id="terms"
              rows={6}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Décrivez le fonctionnement, les engagements et la rémunération."
            />
          </div>
          <div className="flex items-center gap-3 rounded-md border p-3">
            <Switch
              id="public_enabled"
              checked={publicEnabled}
              onCheckedChange={setPublicEnabled}
            />
            <div>
              <Label htmlFor="public_enabled" className="cursor-pointer">
                Page publique d&apos;inscription
              </Label>
              <p className="text-xs text-muted-foreground">
                URL d&apos;inscription pour ce programme :{" "}
                <span className="font-mono break-all">
                  …/p/{publicSlug}?program={program.slug}
                </span>
              </p>
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
