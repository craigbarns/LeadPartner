import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogoutForm } from "@/components/app/logout-form";
import { MobileNav } from "@/components/app/mobile-nav";
import { initials } from "@/lib/utils";
import type { AppRole } from "@/types/database";

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super admin",
  company_admin: "Administrateur",
  collaborator: "Collaborateur",
  referrer: "Apporteur",
};

export function Header({
  email,
  fullName,
  role,
}: {
  email: string;
  fullName: string | null;
  role: AppRole;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/85 backdrop-blur px-4 md:px-8">
      <MobileNav role={role} />
      <div className="hidden md:flex items-center gap-3 micro text-muted-foreground">
        <span>{ROLE_LABEL[role]}</span>
        <span className="h-1 w-1 bg-foreground" />
        <span className="font-mono text-[10px] tabular">
          {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 px-2 gap-2 rounded-none">
              <Avatar className="h-7 w-7 rounded-none">
                <AvatarFallback className="text-xs rounded-none bg-foreground text-background font-mono tabular">
                  {initials(fullName ?? email)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden sm:inline">{fullName ?? email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-none">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-display text-base">{fullName ?? "Mon compte"}</span>
              <span className="text-xs text-muted-foreground font-mono tabular">{email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">Profil</Link>
            </DropdownMenuItem>
            {(role === "company_admin" || role === "super_admin") && (
              <DropdownMenuItem asChild>
                <Link href="/settings">Paramètres</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <LogoutForm />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
