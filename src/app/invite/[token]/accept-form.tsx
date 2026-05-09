"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { AppRole } from "@/types/database";

export function InviteAcceptForm({
  tenantId,
  email,
  role,
  token: _token,
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
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message ?? "Erreur lors de la création du compte.");
      return;
    }

    const { error: memberError } = await supabase.from("tenant_members").insert({
      tenant_id: tenantId,
      user_id: data.user.id,
      role,
      status: "active",
    });

    if (!memberError) {
      await supabase
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitationId);
    }

    setLoading(false);
    if (memberError) {
      toast.error(memberError.message);
      return;
    }
    toast.success("Bienvenue !");
    const sigEnabled = process.env.NEXT_PUBLIC_ENABLE_CONTRACT_SIGNATURE === "true";
    if (sigEnabled && role === "referrer") {
      router.push("/onboarding/referrer");
    } else {
      router.push("/dashboard");
    }
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
