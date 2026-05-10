"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  Handshake,
  Home,
  LayoutDashboard,
  LineChart,
  Settings,
  Sparkles,
  Tags,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/database";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const NAV_BY_ROLE: Record<AppRole, { section: string; items: NavItem[] }[]> = {
  super_admin: [
    {
      section: "Plateforme",
      items: [
        { href: "/super-admin", label: "Vue globale", icon: LayoutDashboard },
        { href: "/super-admin/tenants", label: "Entreprises", icon: Building2 },
        { href: "/super-admin/subscriptions", label: "Abonnements", icon: CreditCard },
        { href: "/super-admin/analytics", label: "Analytics", icon: LineChart },
      ],
    },
  ],
  company_admin: [
    {
      section: "Pilotage",
      items: [
        { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
        { href: "/opportunities", label: "Opportunités", icon: Target },
        { href: "/commissions", label: "Commissions", icon: CreditCard },
      ],
    },
    {
      section: "Programme",
      items: [
        { href: "/referrers", label: "Apporteurs", icon: Handshake },
        { href: "/team", label: "Équipe", icon: Users },
        { href: "/program", label: "Programme", icon: Sparkles },
      ],
    },
    {
      section: "Configuration",
      items: [
        { href: "/settings", label: "Paramètres", icon: Settings },
      ],
    },
  ],
  collaborator: [
    {
      section: "Travail quotidien",
      items: [
        { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
        { href: "/opportunities", label: "Opportunités", icon: Target },
        { href: "/commissions", label: "Commissions", icon: CreditCard },
      ],
    },
    {
      section: "Programme",
      items: [
        { href: "/referrers", label: "Apporteurs", icon: Handshake },
        { href: "/team", label: "Équipe", icon: Users },
      ],
    },
  ],
  referrer: [
    {
      section: "Mon activité",
      items: [
        { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
        { href: "/opportunities", label: "Mes opportunités", icon: Target },
        { href: "/opportunities/new", label: "Déclarer", icon: Tags },
        { href: "/commissions", label: "Mes commissions", icon: CreditCard },
        { href: "/referral", label: "Mon lien", icon: Handshake },
      ],
    },
  ],
};

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super admin",
  company_admin: "Administrateur",
  collaborator: "Collaborateur",
  referrer: "Apporteur",
};

export function Sidebar({
  role,
  tenantName,
  primaryColor,
}: {
  role: AppRole;
  tenantName?: string | null;
  primaryColor?: string | null;
}) {
  const pathname = usePathname();
  const sections = NAV_BY_ROLE[role];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border h-screen sticky top-0 bg-background">
      {/* Brand mark */}
      <div className="px-6 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative">
            <div
              className="h-9 w-9 transition-transform group-hover:rotate-3"
              style={{ background: primaryColor ?? "hsl(var(--foreground))" }}
            />
            <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 bg-accent" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-display text-lg truncate">{tenantName ?? "LeadPartner"}</span>
            <span className="micro text-muted-foreground">{ROLE_LABEL[role]}</span>
          </div>
        </Link>
      </div>

      {/* Sections */}
      <nav className="flex-1 px-4 py-6 space-y-7 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.section} className="space-y-1.5">
            <div className="micro text-muted-foreground px-2 mb-2">{section.section}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 px-2 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="h-3 w-3" />
          Site public
        </Link>
        <span className="font-mono text-[10px] text-muted-foreground tabular">
          v0.1
        </span>
      </div>
    </aside>
  );
}
