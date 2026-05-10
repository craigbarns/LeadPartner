"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProgram } from "./actions";

export function CreateProgramForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const res = await createProgram(fd);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Programme créé.");
    router.push(`/program/${res.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 border border-border bg-card p-4">
      <div className="space-y-1.5 flex-1 min-w-[200px]">
        <Label htmlFor="newProgramName">Nouveau programme</Label>
        <Input
          id="newProgramName"
          name="name"
          required
          placeholder="Ex. Formation Excel avancé"
          className="h-10"
        />
      </div>
      <Button type="submit" disabled={loading} variant="outline" className="h-10">
        <PlusCircle className="h-4 w-4" /> {loading ? "Création…" : "Ajouter"}
      </Button>
    </form>
  );
}
