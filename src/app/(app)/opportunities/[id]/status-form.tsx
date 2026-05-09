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
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { OpportunityStatus } from "@/types/database";

export function OpportunityStatusForm({
  opportunityId,
  tenantId,
  currentStatus,
  statuses,
  currentClosedValue,
}: {
  opportunityId: string;
  tenantId: string;
  currentStatus: OpportunityStatus;
  statuses: { value: OpportunityStatus; label: string }[];
  currentClosedValue: number | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OpportunityStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [closedValue, setClosedValue] = useState(currentClosedValue?.toString() ?? "");
  const [loading, setLoading] = useState(false);

  const isWon = status === "sale_closed" || status === "commission_due" || status === "commission_paid";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const update: Record<string, unknown> = { status };
    if (isWon && closedValue) {
      update.closed_value = Number(closedValue);
      update.closed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("opportunities")
      .update(update)
      .eq("id", opportunityId);

    if (!error && note.trim()) {
      await supabase.from("opportunity_status_history").insert({
        opportunity_id: opportunityId,
        tenant_id: tenantId,
        to_status: status,
        note: note.trim(),
      });
    }
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Statut mis à jour.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mettre à jour le statut</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nouveau statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OpportunityStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isWon && (
            <div className="space-y-2">
              <Label htmlFor="closedValue">Montant final (€)</Label>
              <Input
                id="closedValue"
                type="number"
                step="0.01"
                value={closedValue}
                onChange={(e) => setClosedValue(e.target.value)}
                placeholder="Ex: 12500"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="note">Note (optionnelle)</Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contexte du changement"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Mise à jour..." : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
