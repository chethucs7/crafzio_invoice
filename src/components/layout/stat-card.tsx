import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tint = "primary",
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tint?: "primary" | "success" | "warning" | "destructive" | "info";
  hint?: string;
}) {
  const tints: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
  };
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft transition hover:shadow-lift">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("grid h-10 w-10 place-items-center rounded-lg", tints[tint])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
