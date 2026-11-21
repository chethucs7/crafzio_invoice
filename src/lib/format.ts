export function formatCurrency(value: number | string | undefined, symbol = "₹"): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return `${symbol}${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

export function statusColor(status?: string): string {
  switch (status) {
    case "paid":
    case "completed":
    case "active": return "bg-success/15 text-success border-success/20";
    case "partial":
    case "sent": return "bg-info/15 text-info border-info/20";
    case "overdue":
    case "cancelled": return "bg-destructive/15 text-destructive border-destructive/20";
    case "unpaid": return "bg-warning/15 text-warning border-warning/20";
    case "due": return "bg-orange-100 text-orange-600 border-orange-200";
    case "draft":
    case "planning": return "bg-muted text-muted-foreground border-border";
    default: return "bg-warning/15 text-warning-foreground border-warning/20";
  }
}
