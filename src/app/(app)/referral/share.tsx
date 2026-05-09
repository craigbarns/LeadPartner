"use client";

import { Copy, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButtons({
  link,
  code,
  tenantName,
}: {
  link: string;
  code: string;
  tenantName: string;
}) {
  async function copyLink() {
    await navigator.clipboard.writeText(link);
    toast.success("Lien copié.");
  }
  const subject = encodeURIComponent(
    `Profitez de ${tenantName} grâce à mon lien d'apporteur`,
  );
  const body = encodeURIComponent(
    `Bonjour,\n\nJe vous recommande ${tenantName}. Inscrivez-vous via mon lien :\n${link}\n\nCode : ${code}`,
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={copyLink}>
        <Copy className="h-4 w-4" /> Copier le lien
      </Button>
      <Button variant="outline" asChild>
        <a href={`mailto:?subject=${subject}&body=${body}`}>
          <Mail className="h-4 w-4" /> Email
        </a>
      </Button>
      <Button variant="outline" asChild>
        <a
          href={`https://wa.me/?text=${body}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      </Button>
    </div>
  );
}
