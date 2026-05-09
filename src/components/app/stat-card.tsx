import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  accent = false,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: number; positive?: boolean };
  accent?: boolean;
  accentColor?: string;
}) {
  return (
    <div
      className={cn(
        "relative border border-border bg-card p-5 lg:p-6 flex flex-col gap-4 group transition-colors",
        accent && "bg-foreground text-background",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="micro text-muted-foreground group-hover:text-current">{title}</div>
        {Icon && (
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              accent ? "text-background/60" : "text-muted-foreground",
            )}
          />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-5xl lg:text-6xl tracking-tightest tabular leading-none">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "font-mono text-xs tabular px-1.5 py-0.5",
              trend.positive
                ? "bg-accent text-accent-foreground"
                : "bg-destructive text-destructive-foreground",
            )}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}%
          </span>
        )}
      </div>
      {hint && (
        <p
          className={cn(
            "text-xs leading-relaxed",
            accent ? "text-background/60" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
