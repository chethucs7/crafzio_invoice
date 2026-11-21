import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, statusColor } from "@/lib/format";
import { Wallet, TrendingUp, Clock, Receipt } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const today = new Date();
  const [start, setStart] = useState(new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));
  const [applied, setApplied] = useState({ start, end });

  const sales = useQuery({
    queryKey: ["report-sales", applied],
    queryFn: async () => (await api.get("/reports/sales", { params: applied })).data as {
      total: number; paid: number; outstanding: number; count: number; invoices: Invoice[];
    },
  });
  const gst = useQuery({
    queryKey: ["report-gst", applied],
    queryFn: async () => (await api.get("/reports/gst", { params: applied })).data as {
      cgst: number; sgst: number; igst: number; total_tax: number;
    },
  });

  return (
    <>
      <PageHeader title="Reports" description="Sales, GST and outstanding summaries" />

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-soft">
        <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <Button onClick={() => setApplied({ start, end })}>Apply</Button>
      </div>

      {sales.data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total invoiced" value={formatCurrency(sales.data.total)} icon={TrendingUp} tint="primary" />
            <StatCard label="Paid" value={formatCurrency(sales.data.paid)} icon={Wallet} tint="success" />
            <StatCard label="Outstanding" value={formatCurrency(sales.data.outstanding)} icon={Clock} tint="warning" />
            <StatCard label="Invoices" value={String(sales.data.count)} icon={Receipt} />
          </div>

          {gst.data && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="CGST" value={formatCurrency(gst.data.cgst)} icon={Receipt} tint="info" />
              <StatCard label="SGST" value={formatCurrency(gst.data.sgst)} icon={Receipt} tint="info" />
              <StatCard label="IGST" value={formatCurrency(gst.data.igst)} icon={Receipt} tint="info" />
              <StatCard label="Total tax" value={formatCurrency(gst.data.total_tax)} icon={Receipt} tint="primary" />
            </div>
          )}

          <div className="mt-6 rounded-xl border bg-card shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.data.invoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                    <TableCell>{i.client}</TableCell>
                    <TableCell>{formatDate(i.invoice_date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.grand_total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.amount_paid)}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase", statusColor(i.status))}>
                        {i.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
