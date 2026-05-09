"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ReferrerSignupForm({
  tenantId,
  tenantName,
  programId: _programId,
  referralCode,
  primaryColor,
}: {
  tenantId: string;
  tenantName: string;
  programId: string;
  referralCode: string | null;
  primaryColor: string | null;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) {
      toast.error("Vous devez accepter les conditions du programme.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          referred_by: referralCode,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message ?? "Erreur d'inscription.");
      return;
    }

    const { error: insertError } = await supabase.from("tenant_members").insert({
      tenant_id: tenantId,
      user_id: data.user.id,
      role: "referrer",
      status: "active",
    });

    setLoading(false);
    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    toast.success(`Bienvenue dans le programme ${tenantName} !`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Téléphone (optionnel)</Label>
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {referralCode && (
        <div className="rounded-md border bg-secondary/40 p-2 text-xs">
          Parrainé par : <code className="font-mono">{referralCode}</code>
        </div>
      )}
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          J&apos;accepte les conditions du programme {tenantName} et la politique de
          confidentialité.
        </span>
      </label>
      <Button
        type="submit"
        className="w-full"
        disabled={loading}
        style={primaryColor ? { background: primaryColor } : undefined}
      >
        {loading ? "Inscription..." : "Devenir apporteur"}
      </Button>
    </form>
  );
}
