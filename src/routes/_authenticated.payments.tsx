import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { formatCurrency, formatDate, statusColor } from "@/lib/format";
import type { Payment, Invoice } from "@/lib/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Clock, Wallet, Search, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

// Helper: invoices that still have a balance due (remaining/pending)
interface RemainingRow {
  id: number; invoice_number: string; client?: string;
  due_date?: string; grand_total: number; amount_paid: number;
  balance_due: number; status: string;
}

function PaymentsPage() {
  const [search, setSearch] = useState("");

  /* ── Received payments ── */
  const { data: paymentsData } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => (await api.get("/payments")).data as { data: Payment[] },
  });

  /* ── Invoice map for received tab ── */
  const invoicesQ = useQuery({
    queryKey: ["invoice-map"],
    queryFn: async () =>
      (await api.get("/invoices", { params: { per_page: 500 } })).data as { data: Invoice[] },
  });
  const invMap = new Map(invoicesQ.data?.data.map((i) => [i.id, i]) ?? []);

  /* ── Remaining: all invoices with balance_due > 0 ── */
  const remainingQ = useQuery({
    queryKey: ["invoices-remaining"],
    queryFn: async () =>
      (await api.get("/invoices", { params: { per_page: 500 } })).data as { data: Invoice[] },
  });
  const remainingRows: RemainingRow[] = useMemo(
    () =>
      (remainingQ.data?.data ?? [])
        .filter((i) => Number(i.balance_due ?? i.grand_total ?? 0) > 0)
        .map((i) => ({
          id: i.id,
          invoice_number: i.invoice_number,
          client: i.client,
          due_date: i.due_date,
          grand_total: Number(i.grand_total ?? 0),
          amount_paid: Number(i.amount_paid ?? 0),
          balance_due: Number(i.balance_due ?? i.grand_total ?? 0),
          status: i.status,
        })),
    [remainingQ.data]
  );

  /* ── Summary numbers ── */
  const totalReceived = useMemo(
    () => (paymentsData?.data ?? []).reduce((s, p) => s + Number(p.amount), 0),
    [paymentsData]
  );
  const totalRemaining = useMemo(
    () => remainingRows.reduce((s, r) => s + r.balance_due, 0),
    [remainingRows]
  );
  const overdueRows = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return remainingRows.filter((r) => r.due_date && r.due_date < today);
  }, [remainingRows]);

  /* ── Filtered lists ── */
  const q = search.toLowerCase();
  const filteredPayments = useMemo(
    () =>
      (paymentsData?.data ?? []).filter((p) => {
        if (!q) return true;
        const inv = invMap.get(p.invoice_id);
        return (
          inv?.invoice_number?.toLowerCase().includes(q) ||
          String(inv?.client ?? "").toLowerCase().includes(q) ||
          (p.method ?? "").toLowerCase().includes(q) ||
          (p.transaction_id ?? "").toLowerCase().includes(q)
        );
      }),
    [paymentsData, q, invMap]
  );
  const filteredRemaining = useMemo(
    () =>
      remainingRows.filter((r) =>
        !q ||
        r.invoice_number.toLowerCase().includes(q) ||
        (r.client ?? "").toLowerCase().includes(q)
      ),
    [remainingRows, q]
  );

  return (
    <>
      <PageHeader title="Payments" description="Track received payments and outstanding balances" />

      {/* ── Summary cards ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total Received"
          value={formatCurrency(totalReceived)}
          count={paymentsData?.data.length ?? 0}
          countLabel="payments"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          className="border-emerald-200 bg-emerald-50/60"
          valueClass="text-emerald-700"
        />
        <SummaryCard
          label="Remaining (Pending)"
          value={formatCurrency(totalRemaining)}
          count={remainingRows.length}
          countLabel="invoices"
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          className="border-amber-200 bg-amber-50/60"
          valueClass="text-amber-700"
        />
        <SummaryCard
          label="Overdue"
          value={formatCurrency(overdueRows.reduce((s, r) => s + r.balance_due, 0))}
          count={overdueRows.length}
          countLabel="invoices"
          icon={<AlertCircle className="h-5 w-5 text-red-600" />}
          className="border-red-200 bg-red-50/60"
          valueClass="text-red-700"
        />
      </div>

      {/* ── Search ── */}
      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-md border bg-card px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search invoice, client, method…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 focus-visible:ring-0"
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            <Wallet className="mr-1.5 h-3.5 w-3.5" />
            All Payments ({paymentsData?.data.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="received">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Received ({filteredPayments.length})
          </TabsTrigger>
          <TabsTrigger value="remaining">
            <Clock className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
            Remaining ({filteredRemaining.length})
          </TabsTrigger>
          <TabsTrigger value="expected">
            <AlertCircle className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
            Expected ({filteredRemaining.length})
          </TabsTrigger>
        </TabsList>

        {/* ALL */}
        <TabsContent value="all">
          <PaymentsTable payments={filteredPayments} invMap={invMap} />
        </TabsContent>

        {/* RECEIVED */}
        <TabsContent value="received">
          <PaymentsTable payments={filteredPayments} invMap={invMap} />
        </TabsContent>

        {/* REMAINING */}
        <TabsContent value="remaining">
          <div className="rounded-xl border bg-card shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Invoice Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRemaining.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        <p className="text-sm font-medium">All caught up! No outstanding balances.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filteredRemaining.map((r) => {
                  const today = new Date().toISOString().split("T")[0];
                  const isOverdue = r.due_date && r.due_date < today;
                  return (
                    <TableRow
                      key={r.id}
                      className={cn("hover:bg-muted/30", isOverdue && "bg-red-50/40")}
                    >
                      <TableCell className="font-mono text-xs font-semibold">
                        <Link
                          to="/invoices/$id"
                          params={{ id: String(r.id) }}
                          className="hover:text-primary hover:underline"
                        >
                          {r.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{r.client}</TableCell>
                      <TableCell>
                        <span className={cn("text-sm", isOverdue && "font-semibold text-red-600")}>
                          {r.due_date ? formatDate(r.due_date) : "—"}
                          {isOverdue && (
                            <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">
                              Overdue
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(r.grand_total)}</TableCell>
                      <TableCell className="text-right text-sm text-emerald-600">{formatCurrency(r.amount_paid)}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">{formatCurrency(r.balance_due)}</TableCell>
                      <TableCell>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase font-medium", statusColor(r.status))}>
                          {r.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* EXPECTED */}
        <TabsContent value="expected">
          <div className="space-y-6">
            {(() => {
              const todayStr = new Date().toISOString().split("T")[0];
              const getDaysDiff = (dStr?: string) => {
                if (!dStr) return 999;
                const diffTime = new Date(dStr).getTime() - new Date(todayStr).getTime();
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              };

              const overdue = filteredRemaining.filter((r) => r.due_date && r.due_date < todayStr);
              const dueToday = filteredRemaining.filter((r) => r.due_date === todayStr);
              const dueWeek = filteredRemaining.filter((r) => {
                const diff = getDaysDiff(r.due_date);
                return diff > 0 && diff <= 7;
              });
              const dueMonth = filteredRemaining.filter((r) => {
                const diff = getDaysDiff(r.due_date);
                return diff > 7 && diff <= 30;
              });

              return (
                <>
                  {/* Alert 1: Overdue */}
                  {overdue.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        <h3 className="font-semibold text-sm">Overdue Payments ({overdue.length})</h3>
                        <span className="ml-auto font-bold">{formatCurrency(overdue.reduce((s, x) => s + x.balance_due, 0))}</span>
                      </div>
                      <p className="mt-1 text-xs text-red-600">The following invoices are past their due dates. Follow up with clients immediately.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {overdue.map((i) => (
                          <Link
                            key={i.id}
                            to="/invoices/$id"
                            params={{ id: String(i.id) }}
                            className="flex items-center justify-between rounded-lg border border-red-100 bg-white px-3 py-2 text-xs hover:border-red-300 transition-all"
                          >
                            <span className="font-semibold text-red-700">{i.invoice_number} ({i.client})</span>
                            <span className="font-bold text-red-700">{formatCurrency(i.balance_due)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alert 2: Due Today */}
                  {dueToday.length > 0 && (
                    <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                      <div className="flex items-center gap-2 text-orange-700">
                        <Clock className="h-5 w-5 animate-pulse" />
                        <h3 className="font-semibold text-sm">Due Today ({dueToday.length})</h3>
                        <span className="ml-auto font-bold">{formatCurrency(dueToday.reduce((s, x) => s + x.balance_due, 0))}</span>
                      </div>
                      <p className="mt-1 text-xs text-orange-600">These payments are expected to clear today. Keep track of incoming bank notifications.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {dueToday.map((i) => (
                          <Link
                            key={i.id}
                            to="/invoices/$id"
                            params={{ id: String(i.id) }}
                            className="flex items-center justify-between rounded-lg border border-orange-100 bg-white px-3 py-2 text-xs hover:border-orange-300 transition-all"
                          >
                            <span className="font-semibold text-orange-700">{i.invoice_number} ({i.client})</span>
                            <span className="font-bold text-orange-700">{formatCurrency(i.balance_due)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alert 3: Due This Week */}
                  {dueWeek.length > 0 && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Clock className="h-5 w-5" />
                        <h3 className="font-semibold text-sm">Expected within 7 Days ({dueWeek.length})</h3>
                        <span className="ml-auto font-bold">{formatCurrency(dueWeek.reduce((s, x) => s + x.balance_due, 0))}</span>
                      </div>
                      <p className="mt-1 text-xs text-blue-600">Expected to be received within the next week.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {dueWeek.map((i) => (
                          <Link
                            key={i.id}
                            to="/invoices/$id"
                            params={{ id: String(i.id) }}
                            className="flex items-center justify-between rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs hover:border-blue-300 transition-all"
                          >
                            <span className="font-semibold text-blue-700">{i.invoice_number} ({i.client})</span>
                            <div>
                              <span className="font-bold text-blue-700">{formatCurrency(i.balance_due)}</span>
                              <p className="text-[9px] text-muted-foreground text-right">due {i.due_date ? formatDate(i.due_date) : ""}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alert 4: Due This Month */}
                  {dueMonth.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <h3 className="font-semibold text-sm">Expected within 30 Days ({dueMonth.length})</h3>
                        <span className="ml-auto font-bold">{formatCurrency(dueMonth.reduce((s, x) => s + x.balance_due, 0))}</span>
                      </div>
                      <p className="mt-1 text-xs text-emerald-600">Longer term expected cash inflow for this month.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {dueMonth.map((i) => (
                          <Link
                            key={i.id}
                            to="/invoices/$id"
                            params={{ id: String(i.id) }}
                            className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs hover:border-emerald-300 transition-all"
                          >
                            <span className="font-semibold text-emerald-700">{i.invoice_number} ({i.client})</span>
                            <div>
                              <span className="font-bold text-emerald-700">{formatCurrency(i.balance_due)}</span>
                              <p className="text-[9px] text-muted-foreground text-right">due {i.due_date ? formatDate(i.due_date) : ""}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredRemaining.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground">No expected payments currently. All invoices are settled!</div>
                  )}
                </>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

// ── Received payments table ──────────────────────────────────────────────────
function PaymentsTable({ payments, invMap }: { payments: Payment[]; invMap: Map<number, Invoice> }) {
  return (
    <div className="rounded-xl border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Wallet className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No payments yet.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
          {payments.map((p) => {
            const inv = invMap.get(p.invoice_id);
            return (
              <TableRow key={p.id} className="hover:bg-muted/30">
                <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                <TableCell className="font-mono text-xs font-semibold">
                  {inv ? (
                    <Link to="/invoices/$id" params={{ id: String(inv.id) }} className="hover:text-primary hover:underline">
                      {inv.invoice_number}
                    </Link>
                  ) : `#${p.invoice_id}`}
                </TableCell>
                <TableCell>{inv?.client}</TableCell>
                <TableCell>
                  {p.method ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase font-medium">
                      {p.method}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {p.transaction_id || p.reference_number || "—"}
                </TableCell>
                <TableCell className="text-right font-semibold text-emerald-600">
                  +{formatCurrency(p.amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, count, countLabel, icon, className, valueClass,
}: {
  label: string; value: string; count: number; countLabel: string;
  icon: React.ReactNode; className?: string; valueClass?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 rounded-xl border p-4", className)}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/70 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-bold", valueClass)}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{count} {countLabel}</p>
      </div>
    </div>
  );
}
