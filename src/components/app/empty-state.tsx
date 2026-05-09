import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-border bg-card flex flex-col items-center text-center gap-4 py-16 px-6">
      <div className="relative">
        <div className="h-12 w-12 bg-secondary flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 bg-accent" />
      </div>
      <h3 className="font-display text-2xl tracking-tightest">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>
      )}
      {action}
    </div>
  );
}
