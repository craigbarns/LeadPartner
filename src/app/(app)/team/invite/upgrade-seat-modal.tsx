"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradeSeatModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  memberLabel: string;
}

export function UpgradeSeatModal({ open, onClose, onConfirmed, memberLabel }: UpgradeSeatModalProps) {
  const [preview, setPreview] = useState<{ monthlyAmountCents: number; proratedAmountCents: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPreview(null);
    setError(null);
    fetch("/api/stripe/seats/preview", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.detail ?? data.error);
        else setPreview(data);
      })
      .finally(() => setLoading(false));
  }, [open]);

  async function confirm() {
    setConfirming(true);
    setError(null);
    const res = await fetch("/api/stripe/seats/add", { method: "POST" });
    const data = await res.json();
    setConfirming(false);
    if (!res.ok) {
      setError(data.detail ?? data.error ?? "Erreur");
      return;
    }
    onConfirmed();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter {memberLabel} dépasse votre quota</DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm">Calcul du coût...</p>}
        {preview && (
          <div className="space-y-2 text-sm">
            <p>
              Cela ajoutera <strong>{(preview.monthlyAmountCents / 100).toFixed(2)} €/mois</strong> à votre
              abonnement.
            </p>
            <p>
              Facturé aujourd&apos;hui au prorata :{" "}
              <strong>{(preview.proratedAmountCents / 100).toFixed(2)} €</strong>.
            </p>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={confirming}>
            Annuler
          </Button>
          <Button onClick={confirm} disabled={loading || confirming || !preview}>
            {confirming ? "Ajout..." : "Confirmer et ajouter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
