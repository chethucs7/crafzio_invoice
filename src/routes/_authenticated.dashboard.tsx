import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import {
  Wallet, TrendingUp, Users, FileText, Receipt,
  AlertCircle, Clock, CheckCircle2, CalendarClock, ArrowRight,
  CalendarDays, ChevronDown, ChevronUp, Search, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, statusColor } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale,
  Tooltip, Legend,
} from "chart.js";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface IncomingItem {
  id: number; invoice_number: string; client: string;
  due_date: string; balance_due: number; status: string;
}
interface IncomingBucket { items: IncomingItem[]; total: number }
interface Incoming {
  overdue: IncomingBucket; next_7: IncomingBucket;
  next_30: IncomingBucket; next_90: IncomingBucket;
}

function DashboardPage() {
  const [clientSearch, setClientSearch] = useState("");

  const { data, isLoading } = useQuery<DashboardStats & { incoming: Incoming }>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard/stats")).data,
    refetchInterval: 60_000,
  });

  const clients = useQuery({
    queryKey: ["dashboard-clients-search", clientSearch],
    queryFn: async () =>
      (await api.get("/clients", { params: { q: clientSearch, per_page: 5 } })).data as { data: Client[] },
    enabled: clientSearch.trim().length > 0,
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Snapshot of your revenue, invoices and clients"
      />

      {/* ── Client Search Bar ── */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex max-w-md items-center gap-2 rounded-xl border bg-card px-3 shadow-soft py-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers by name, email, phone…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 text-sm h-8"
          />
          {clientSearch && (
            <button
              onClick={() => setClientSearch("")}
              className="text-xs text-muted-foreground hover:text-foreground mr-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search Results */}
        {clientSearch.trim().length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-soft max-w-xl">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Matching Customers</h4>
            {clients.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-primary" /> Searching…
              </div>
            ) : (clients.data?.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No customer matches found.</p>
            ) : (
              <div className="grid gap-2.5">
                {(clients.data?.data ?? []).map((c) => (
                  <Link
                    key={c.id}
                    to="/clients/$id"
                    params={{ id: String(c.id) }}
                    className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs hover:bg-muted/55 transition-all"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.email || "No email"} • {c.phone || "No phone"}</p>
                    </div>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] uppercase font-bold",
                      c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                    )}>
                      {c.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Today's Revenue" value={formatCurrency(data.today_revenue)} icon={TrendingUp} tint="success" />
            <StatCard label="This Month" value={formatCurrency(data.monthly_revenue)} icon={Wallet} tint="primary" />
            <StatCard label="This Year" value={formatCurrency(data.yearly_revenue)} icon={TrendingUp} tint="info" />
            <StatCard label="Total Paid" value={formatCurrency(data.paid)} icon={CheckCircle2} tint="success" />
            <StatCard label="Pending" value={formatCurrency(data.pending)} icon={Clock} tint="warning" />
            <StatCard label="Overdue" value={formatCurrency(data.overdue)} icon={AlertCircle} tint="destructive" />
            <StatCard label="Clients" value={String(data.total_clients)} icon={Users} hint={`${data.active_clients} active`} />
            <StatCard label="Invoices" value={String(data.invoices_generated)} icon={FileText} hint={`GST ${formatCurrency(data.gst_collected)}`} />
          </div>

          {/* ── Payment Timeline ── */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Incoming Payments</h2>
              <span className="text-xs text-muted-foreground">— when amounts are due and how much</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <IncomingBucketCard
                label="Overdue"
                sublabel="Past due date"
                bucket={data.incoming?.overdue}
                color="bg-red-500"
                textColor="text-red-600"
                badgeClass="bg-red-100 text-red-700"
                icon={<AlertCircle className="h-4 w-4 text-red-500" />}
              />
              <IncomingBucketCard
                label="Next 7 Days"
                sublabel="Due this week"
                bucket={data.incoming?.next_7}
                color="bg-orange-400"
                textColor="text-orange-600"
                badgeClass="bg-orange-100 text-orange-700"
                icon={<CalendarDays className="h-4 w-4 text-orange-500" />}
              />
              <IncomingBucketCard
                label="Next 30 Days"
                sublabel="Due this month"
                bucket={data.incoming?.next_30}
                color="bg-blue-500"
                textColor="text-blue-600"
                badgeClass="bg-blue-100 text-blue-700"
                icon={<Clock className="h-4 w-4 text-blue-500" />}
              />
              <IncomingBucketCard
                label="Next 90 Days"
                sublabel="Due this quarter"
                bucket={data.incoming?.next_90}
                color="bg-emerald-500"
                textColor="text-emerald-600"
                badgeClass="bg-emerald-100 text-emerald-700"
                icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              />
            </div>
          </div>

          {/* ── Charts ── */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-5 shadow-soft lg:col-span-2">
              <h3 className="text-sm font-semibold">Monthly revenue</h3>
              <p className="mb-4 text-xs text-muted-foreground">Last 12 months (paid)</p>
              <div className="h-64">
                <Bar
                  data={{
                    labels: data.monthly.map((m) => m.month),
                    datasets: [
                      {
                        label: "Revenue",
                        data: data.monthly.map((m) => m.revenue),
                        backgroundColor: "oklch(0.52 0.18 258 / 0.8)",
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false } } },
                  }}
                />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-semibold">Invoice status</h3>
              <p className="mb-4 text-xs text-muted-foreground">Distribution</p>
              <div className="h-64">
                <Doughnut
                  data={{
                    labels: data.status_pie.map((s) => s.status),
                    datasets: [{
                      data: data.status_pie.map((s) => s.count),
                      backgroundColor: [
                        "oklch(0.62 0.15 152)", "oklch(0.62 0.14 230)",
                        "oklch(0.75 0.14 75)", "oklch(0.58 0.22 27)",
                        "oklch(0.52 0.18 258)", "oklch(0.5 0.02 255)",
                      ],
                      borderWidth: 0,
                    }],
                  }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                />
              </div>
            </div>
          </div>

          {/* ── Bottom lists ── */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ListCard title="Latest invoices" icon={FileText}>
              {data.latest_invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <div className="divide-y">
                  {data.latest_invoices.map((i) => (
                    <div key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{i.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{i.client}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(i.grand_total)}</p>
                        <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase", statusColor(i.status))}>
                          {i.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ListCard>
            <ListCard title="Upcoming due" icon={Receipt}>
              {data.upcoming_due.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming dues.</p>
              ) : (
                <div className="divide-y">
                  {data.upcoming_due.map((i) => (
                    <div key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{i.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{i.client}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(i.balance_due)}</p>
                        <p className="text-xs text-muted-foreground">due {formatDate(i.due_date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ListCard>
          </div>
        </>
      )}
    </>
  );
}

// ── Incoming bucket card with expandable rows ────────────────────────────────
function IncomingBucketCard({
  label, sublabel, bucket, color, textColor, badgeClass, icon,
}: {
  label: string; sublabel: string; bucket?: IncomingBucket;
  color: string; textColor: string; badgeClass: string;
  icon: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = bucket?.items ?? [];
  const total = bucket?.total ?? 0;

  return (
    <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
      {/* Color bar */}
      <div className={cn("h-1 w-full", color)} />
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", badgeClass)}>
            {items.length} inv
          </span>
        </div>
        <p className={cn("text-xl font-bold mt-1", textColor)}>{formatCurrency(total)}</p>
        <p className="text-[11px] text-muted-foreground mb-2">{sublabel}</p>

        {items.length > 0 && (
          <>
            <button
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} details
            </button>

            {expanded && (
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {items.map((it) => (
                  <Link
                    key={it.id}
                    to="/invoices/$id"
                    params={{ id: String(it.id) }}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs hover:bg-muted/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{it.invoice_number}</p>
                      <p className="text-muted-foreground truncate">{it.client}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={cn("font-bold", textColor)}>{formatCurrency(it.balance_due)}</p>
                      <p className="text-muted-foreground">{it.due_date ? formatDate(it.due_date) : "—"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">None in this period</p>
        )}
      </div>
    </div>
  );
}

function ListCard({
  title, icon: Icon, children,
}: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
