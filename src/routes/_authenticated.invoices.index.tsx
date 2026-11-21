import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, API_URL, auth } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Eye, Trash2, Copy, Download, Mail, Pencil, FileText as FileIcon, Loader2, CheckCircle } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { formatCurrency, formatDate, statusColor } from "@/lib/format";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/invoices/")({
  component: InvoicesPage,
});

function InvoicesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", q, status],
    queryFn: async () =>
      (await api.get("/invoices", { params: { q, status: status || undefined } })).data as { data: Invoice[] },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/invoices/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });
  const dup = useMutation({
    mutationFn: (id: number) => api.post(`/invoices/${id}/duplicate`),
    onSuccess: () => { toast.success("Duplicated"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });

  const fetchPdf = async (id: number) => {
    const res = await fetch(`${API_URL}/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${auth.getToken()}` },
    });
    if (!res.ok) { toast.error("Failed to fetch PDF"); return null; }
    return res.blob();
  };
  const downloadPdf = async (id: number, num: string) => {
    const blob = await fetchPdf(id); if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${num}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };
  const previewPdf = async (id: number) => {
    const blob = await fetchPdf(id); if (!blob) return;
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const sendEmail = async (id: number) => {
    setSendingId(id);
    try {
      const r = await api.post(`/invoices/${id}/email`, {});
      if (r.data.ok) {
        toast.success("Email sent successfully!");
        qc.invalidateQueries({ queryKey: ["invoices"] });
        setSentIds(prev => new Set(prev).add(id));
      } else {
        toast.error(`Send failed: ${r.data.error || "check SMTP settings"}`);
      }
    } catch { toast.error("Send failed"); }
    finally { setSendingId(null); }
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Manage, send and track your billing"
        actions={
          <Button asChild><Link to="/invoices/new"><Plus className="mr-2 h-4 w-4" />New invoice</Link></Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex max-w-sm flex-1 items-center gap-2 rounded-md border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice number, notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border-0 focus-visible:ring-0"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {data?.data.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>
            )}
            {data?.data.map((i) => (
              <TableRow key={i.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs font-medium">
                  <Link to="/invoices/$id" params={{ id: String(i.id) }} className="hover:text-primary">
                    {i.invoice_number}
                  </Link>
                </TableCell>
                <TableCell>{i.client}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(i.invoice_date)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(i.due_date)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(i.grand_total)}</TableCell>
                <TableCell className="text-right">{formatCurrency(i.balance_due)}</TableCell>
                <TableCell>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase", statusColor(i.status))}>
                    {i.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="View" asChild>
                      <Link to="/invoices/$id" params={{ id: String(i.id) }}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" title="Preview PDF" onClick={() => previewPdf(i.id)}>
                      <FileIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Download" onClick={() => downloadPdf(i.id, i.invoice_number)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <div className="relative inline-flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={sendingId === i.id ? "Sending…" : sentIds.has(i.id) ? "Sent" : "Send email"}
                        onClick={() => sendEmail(i.id)}
                        disabled={sendingId === i.id}
                        className={cn(
                          sendingId === i.id ? "cursor-not-allowed opacity-70" : "",
                          sentIds.has(i.id) ? "text-green-600" : ""
                        )}
                      >
                        {sendingId === i.id
                          ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          : sentIds.has(i.id)
                            ? <CheckCircle className="h-4 w-4 text-green-600" />
                            : <Mail className="h-4 w-4" />}
                      </Button>
                      {sentIds.has(i.id) && (
                        <span className="absolute -top-1.5 -right-1 rounded-full bg-green-500 px-1 py-px text-[9px] font-bold text-white leading-none">
                          Sent
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" title="Edit" asChild>
                      <Link to="/invoices/$id/edit" params={{ id: String(i.id) }}><Pencil className="h-4 w-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" title="Duplicate" onClick={() => dup.mutate(i.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => { if (confirm("Delete?")) del.mutate(i.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
