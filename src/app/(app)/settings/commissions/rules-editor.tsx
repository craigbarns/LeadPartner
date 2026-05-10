"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import type {
  CommissionBase,
  CommissionRuleType,
  Database,
} from "@/types/database";

type Rule = Database["public"]["Tables"]["commission_rules"]["Row"];

const TYPE_OPTIONS: { value: CommissionRuleType; label: string }[] = [
  { value: "fixed", label: "Montant fixe" },
  { value: "percentage", label: "Pourcentage" },
  { value: "tiered", label: "Par paliers" },
];

const BASE_OPTIONS: { value: CommissionBase; label: string }[] = [
  { value: "contract_amount", label: "Montant du contrat" },
  { value: "fees", label: "Honoraires" },
  { value: "signed_quote", label: "Devis signé" },
  { value: "collected_revenue", label: "CA encaissé" },
];

export function CommissionRulesEditor({
  tenantId,
  initialRules,
  programs,
}: {
  tenantId: string;
  initialRules: Rule[];
  programs: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [loading, setLoading] = useState(false);

  function addRule() {
    setRules((r) => [
      ...r,
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        program_id: null,
        name: "Nouvelle règle",
        type: "percentage",
        base: "contract_amount",
        fixed_amount: null,
        percentage: 5,
        tiers: [],
        is_default: false,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function scopeKey(rule: Rule) {
    return rule.program_id ?? "__global__";
  }

  function update(id: string, patch: Partial<Rule>) {
    setRules((r) => {
      const idx = r.findIndex((x) => x.id === id);
      if (idx === -1) return r;
      const merged: Rule = { ...r[idx], ...patch };
      return r.map((rule) => {
        if (rule.id === id) return merged;
        if (patch.is_default === true && merged.is_default && scopeKey(rule) === scopeKey(merged)) {
          return { ...rule, is_default: false };
        }
        return rule;
      });
    });
  }

  function remove(id: string) {
    setRules((r) => r.filter((rule) => rule.id !== id));
  }

  async function save() {
    setLoading(true);
    const supabase = createClient();
    const hasGlobalDefault = rules.some((x) => x.is_default && x.program_id == null);
    if (rules.length > 0 && !hasGlobalDefault) {
      setLoading(false);
      toast.error(
        "Ajoutez au moins une règle « par défaut » pour « Tous les programmes » (commission de secours).",
      );
      return;
    }
    const { error: deleteError } = await supabase
      .from("commission_rules")
      .delete()
      .eq("tenant_id", tenantId);
    if (deleteError) {
      setLoading(false);
      toast.error(deleteError.message);
      return;
    }
    if (rules.length) {
      const { error } = await supabase.from("commission_rules").insert(
        rules.map((r) => ({
          tenant_id: tenantId,
          program_id: r.program_id ?? null,
          name: r.name,
          type: r.type,
          base: r.base,
          fixed_amount: r.type === "fixed" ? r.fixed_amount : null,
          percentage: r.type === "percentage" ? r.percentage : null,
          tiers: r.type === "tiered" ? r.tiers : [],
          is_default: r.is_default,
        })),
      );
      if (error) {
        setLoading(false);
        toast.error(error.message);
        return;
      }
    }
    setLoading(false);
    toast.success("Règles mises à jour.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              <Input
                value={rule.name}
                onChange={(e) => update(rule.id, { name: e.target.value })}
                className="max-w-md"
              />
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => remove(rule.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Programme concerné</Label>
              <Select
                value={rule.program_id ?? "__all__"}
                onValueChange={(v) =>
                  update(rule.id, { program_id: v === "__all__" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les programmes (défaut global)</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Une règle « par défaut » par portée : une globale obligatoire, plus une par programme si
                vous le souhaitez.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={rule.type}
                onValueChange={(v) => update(rule.id, { type: v as CommissionRuleType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base de calcul</Label>
              <Select
                value={rule.base}
                onValueChange={(v) => update(rule.id, { base: v as CommissionBase })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BASE_OPTIONS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {rule.type === "fixed" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Montant fixe (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rule.fixed_amount ?? ""}
                  onChange={(e) =>
                    update(rule.id, { fixed_amount: Number(e.target.value) })
                  }
                />
              </div>
            )}
            {rule.type === "percentage" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Pourcentage (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rule.percentage ?? ""}
                  onChange={(e) =>
                    update(rule.id, { percentage: Number(e.target.value) })
                  }
                />
              </div>
            )}
            {rule.type === "tiered" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Paliers (JSON)</Label>
                <Input
                  value={JSON.stringify(rule.tiers ?? [])}
                  onChange={(e) => {
                    try {
                      update(rule.id, { tiers: JSON.parse(e.target.value) });
                    } catch {
                      // ignore parse errors during typing
                    }
                  }}
                  placeholder='[{"min":0,"percentage":5},{"min":50000,"percentage":7}]'
                />
                <p className="text-xs text-muted-foreground">
                  Format : tableau d&apos;objets avec <code>min</code> et{" "}
                  <code>percentage</code>.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 md:col-span-2">
              <Switch
                id={`default-${rule.id}`}
                checked={rule.is_default}
                onCheckedChange={(v) => update(rule.id, { is_default: v })}
              />
              <Label htmlFor={`default-${rule.id}`}>Règle par défaut</Label>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={addRule}>
          <PlusCircle className="h-4 w-4" /> Ajouter une règle
        </Button>
        <Button onClick={save} disabled={loading}>
          {loading ? "Enregistrement..." : "Enregistrer les règles"}
        </Button>
      </div>
    </div>
  );
}
