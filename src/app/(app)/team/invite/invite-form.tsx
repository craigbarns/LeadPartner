"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const ROLE_OPTIONS = [
  { value: "company_admin", label: "Administrateur entreprise" },
  { value: "collaborator", label: "Collaborateur" },
  { value: "referrer", label: "Apporteur d'affaires" },
] as const;

export function InviteForm({ tenantId, userId }: { tenantId: string; userId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]["value"]>("referrer");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        tenant_id: tenantId,
        email: email.toLowerCase().trim(),
        role,
        token,
        expires_at: expiresAt,
        invited_by: userId,
      })
      .select("token")
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const link = `${window.location.origin}/invite/${data.token}`;
    setGenerated(link);
    toast.success("Invitation créée. Partagez le lien avec le destinataire.");
    setEmail("");
    router.refresh();
  }

  async function copy() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    toast.success("Lien copié.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nouvelle invitation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email du destinataire</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Création..." : "Générer le lien"}
          </Button>
        </form>
        {generated && (
          <div className="mt-6 rounded-md border bg-secondary/40 p-3">
            <p className="text-sm font-medium mb-2">Lien d&apos;invitation</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs bg-background border rounded px-2 py-1">
                {generated}
              </code>
              <Button size="sm" variant="outline" onClick={copy}>
                Copier
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Le lien expire dans 14 jours.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
