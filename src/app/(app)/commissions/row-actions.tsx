"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MoreHorizontal, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { CommissionStatus } from "@/types/database";

export function CommissionRowActions({
  id,
  status,
}: {
  id: string;
  status: CommissionStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(newStatus: CommissionStatus, paid?: boolean) {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("commissions")
        .update({
          status: newStatus,
          paid_at: paid ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Commission mise à jour.");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status === "estimated" && (
          <DropdownMenuItem onClick={() => update("due")}>
            Marquer comme due
          </DropdownMenuItem>
        )}
        {(status === "estimated" || status === "due") && (
          <DropdownMenuItem onClick={() => update("validated")}>
            <CheckCircle2 className="h-4 w-4" /> Valider
          </DropdownMenuItem>
        )}
        {(status === "due" || status === "validated") && (
          <DropdownMenuItem onClick={() => update("paid", true)}>
            <Wallet className="h-4 w-4" /> Marquer payée
          </DropdownMenuItem>
        )}
        {status !== "canceled" && status !== "paid" && (
          <DropdownMenuItem onClick={() => update("canceled")}>
            <X className="h-4 w-4" /> Annuler
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
