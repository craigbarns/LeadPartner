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
import { createInvitation } from "./actions";
import { UpgradeSeatModal } from "./upgrade-seat-modal";

const ROLE_OPTIONS = [
  { value: "company_admin", label: "Administrateur entreprise" },
  { value: "collaborator", label: "Collaborateur" },
  { value: "referrer", label: "Apporteur d'affaires" },
] as const;

export function InviteForm({
  tenantId,
  userId,
  canInviteAdministrator,
}: {
  tenantId: string;
  userId: string;
  canInviteAdministrator: boolean;
}) {
  const router = useRouter();
  const roleChoices = canInviteAdministrator
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((r) => r.value !== "company_admin");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]["value"]>("referrer");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{ email: string; role: (typeof ROLE_OPTIONS)[number]["value"] } | null>(null);

  async function submitInvitation(nextEmail: string, nextRole: (typeof ROLE_OPTIONS)[number]["value"]) {
    const result = await createInvitation({
      email: nextEmail,
      role: nextRole,
      tenantId,
      userId,
    });
    if (!result.ok) {
      if ("needsUpgrade" in result && result.needsUpgrade) {
        setPendingPayload({ email: nextEmail, role: nextRole });
        setUpgradeOpen(true);
        return;
      }
      toast.error("error" in result ? result.error : "Erreur");
      return;
    }
    const link = `${window.location.origin}/invite/${result.token}`;
    setGenerated(link);
    toast.success("Invitation créée. Partagez le lien avec le destinataire.");
    setEmail("");
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    await submitInvitation(email, role);
    setLoading(false);
  }

  async function copy() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    toast.success("Lien copié.");
  }

  return (
    <>
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
                  {roleChoices.map((r) => (
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
                <code className="flex-1 truncate text-xs bg-background border rounded px-2 py-1">{generated}</code>
                <Button size="sm" variant="outline" onClick={copy}>
                  Copier
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Le lien expire dans 14 jours.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <UpgradeSeatModal
        open={upgradeOpen}
        memberLabel={pendingPayload?.email ?? ""}
        onClose={() => {
          setUpgradeOpen(false);
          setPendingPayload(null);
        }}
        onConfirmed={async () => {
          setUpgradeOpen(false);
          if (!pendingPayload) return;
          setLoading(true);
          await submitInvitation(pendingPayload.email, pendingPayload.role);
          setPendingPayload(null);
          setLoading(false);
        }}
      />
    </>
  );
}
