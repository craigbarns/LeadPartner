"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitation } from "./actions";
import type { AppRole } from "@/types/database";

const ROLE_LABELS: Record<string, string> = {
  company_admin: "Administrateur",
  collaborator: "Collaborateur",
  referrer: "Apporteur d'affaires",
};

const ERROR_MESSAGES: Record<string, string> = {
  invitation_not_found: "Cette invitation n'existe pas.",
  invalid_token: "Lien d'invitation invalide.",
  tenant_mismatch: "Lien d'invitation invalide.",
  email_mismatch: "Lien d'invitation invalide.",
  role_mismatch: "Lien d'invitation invalide.",
  invitation_already_accepted: "Cette invitation a déjà été utilisée. Connectez-vous directement.",
  invitation_expired: "Cette invitation a expiré. Demandez-en une nouvelle.",
  already_member_same_role: "Vous êtes déjà membre de cette entreprise avec ce rôle. Connectez-vous directement.",
  user_creation_failed: "Erreur lors de la création du compte.",
  signin_failed_after_signup: "Compte créé, mais connexion automatique impossible. Connectez-vous manuellement.",
};

function describeError(code: string): string {
  if (code.startsWith("already_member_other_role:")) {
    const role = code.split(":")[1];
    return `Vous êtes déjà membre de cette entreprise en tant que « ${ROLE_LABELS[role] ?? role} ». Un même utilisateur ne peut pas avoir deux rôles différents.`;
  }
  if (code.startsWith("membership_failed:")) {
    return `Erreur lors de l'ajout à l'équipe : ${code.split(":").slice(1).join(":")}`;
  }
  return ERROR_MESSAGES[code] ?? `Erreur : ${code}`;
}

export function InviteAcceptForm({
  tenantId,
  email,
  role,
  token,
  invitationId,
}: {
  tenantId: string;
  email: string;
  role: Exclude<AppRole, "super_admin">;
  token: string;
  invitationId: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const result = await acceptInvitation({
      invitationId,
      tenantId,
      email,
      role,
      fullName,
      password,
      token,
    });

    if (!result.ok) {
      setLoading(false);
      toast.error(describeError(result.error));
      return;
    }

    toast.success("Bienvenue !");
    router.push(result.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe (8 caractères min)</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Création..." : "Accepter et créer mon compte"}
      </Button>
    </form>
  );
}
