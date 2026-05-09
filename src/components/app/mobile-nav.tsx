"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/database";

type NavItem = { href: string; label: string };

const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  super_admin: [
    { href: "/super-admin", label: "Tableau de bord" },
    { href: "/super-admin/tenants", label: "Entreprises" },
    { href: "/super-admin/subscriptions", label: "Abonnements" },
    { href: "/super-admin/analytics", label: "Analytics" },
  ],
  company_admin: [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/opportunities", label: "Opportunités" },
    { href: "/referrers", label: "Apporteurs" },
    { href: "/commissions", label: "Commissions" },
    { href: "/team", label: "Équipe" },
    { href: "/program", label: "Programme" },
    { href: "/settings", label: "Paramètres" },
  ],
  collaborator: [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/opportunities", label: "Opportunités" },
    { href: "/commissions", label: "Commissions" },
  ],
  referrer: [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/opportunities", label: "Mes opportunités" },
    { href: "/opportunities/new", label: "Déclarer" },
    { href: "/commissions", label: "Mes commissions" },
    { href: "/referral", label: "Mon lien" },
  ],
};

export function MobileNav({ role }: { role: AppRole }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm p-0 gap-0 sm:rounded-lg">
        <div className="p-4 border-b font-semibold">Navigation</div>
        <nav className="p-2 space-y-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
