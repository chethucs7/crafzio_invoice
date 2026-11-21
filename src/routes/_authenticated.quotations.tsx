import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileSignature, Trash2, Plus, Save, X, PenSquare,
} from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Client, Service } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/quotations")({
  component: QuotationsPage,
});

interface QuotationRow {
  id: number; quotation_number: string; client?: string;
  quotation_date: string; valid_until?: string; grand_total: number; status: string;
}

interface QItem {
  service_id?: number | ""; description: string;
  quantity: number; rate: number; tax_rate: number;
}
interface QFormValues {
  client_id: number | "";
  quotation_date: string;
  valid_until: string;
  currency: string;
  discount: number;
  notes: string;
  terms: string;
  items: QItem[];
}

// ─── Main Page ───────────────────────────────────────────────────────────────
function QuotationsPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QuotationRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => (await api.get("/quotations")).data as { data: QuotationRow[] },
  });

  const convert = useMutation({
    mutationFn: (id: number) => api.post(`/quotations/${id}/convert`),
    onSuccess: () => { toast.success("Converted to invoice!"); qc.invalidateQueries({ queryKey: ["quotations"] }); },
    onError: () => toast.error("Conversion failed"),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/quotations/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["quotations"] }); },
  });

  const openNew = () => { setEditTarget(null); setFormOpen(true); };

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Proposals and estimates. Convert approved quotations into invoices."
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New Quotation
          </Button>
        }
      />

      <div className="rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground animate-pulse">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <FileSignature className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No quotations yet.</p>
                    <Button size="sm" onClick={openNew}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Create your first quotation
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {(data?.data ?? []).map((q) => (
              <TableRow key={q.id} className="hover:bg-muted/30">
                <TableCell className="font-mono text-xs font-semibold">{q.quotation_number}</TableCell>
                <TableCell>{q.client}</TableCell>
                <TableCell className="text-sm">{formatDate(q.quotation_date)}</TableCell>
                <TableCell className="text-sm">{formatDate(q.valid_until)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(q.grand_total)}</TableCell>
                <TableCell>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase font-medium", statusColor(q.status))}>
                    {q.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost" size="sm"
                      disabled={q.status === "converted" || convert.isPending}
                      onClick={() => convert.mutate(q.id)}
                      title="Convert to Invoice"
                    >
                      <FileSignature className="mr-1 h-4 w-4" />Convert
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => { if (confirm("Delete this quotation?")) del.mutate(q.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Create/Edit dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="h-5 w-5 text-primary" />
              {editTarget ? "Edit Quotation" : "Create Quotation"}
            </DialogTitle>
          </DialogHeader>
          <QuotationForm
            onSuccess={() => {
              setFormOpen(false);
              qc.invalidateQueries({ queryKey: ["quotations"] });
            }}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Quotation Form ───────────────────────────────────────────────────────────
function QuotationForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];

  const clients = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await api.get("/clients", { params: { per_page: 200 } })).data as { data: Client[] },
  });
  const services = useQuery({
    queryKey: ["services-all"],
    queryFn: async () => (await api.get("/services", { params: { per_page: 200 } })).data as { data: Service[] },
  });
  const company = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await api.get("/company")).data as Record<string, any>,
  });

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<QFormValues>({
    defaultValues: {
      client_id: "",
      quotation_date: today,
      valid_until: in30,
      currency: "INR",
      discount: 0,
      notes: "",
      terms: "",
      items: [{ service_id: "", description: "", quantity: 1, rate: 0, tax_rate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
  const watchedDiscount = useWatch({ control, name: "discount" });

  // Prefill terms from company settings
  useEffect(() => {
    if (company.data?.terms) setValue("terms", company.data.terms);
  }, [company.data]);

  const { subtotal, tax, grandTotal } = useMemo(() => {
    const sub = (watchedItems ?? []).reduce((s, it) => s + (+(it.quantity || 0)) * (+(it.rate || 0)), 0);
    const t = (watchedItems ?? []).reduce((s, it) => s + (+(it.quantity || 0)) * (+(it.rate || 0)) * (+(it.tax_rate || 0)) / 100, 0);
    const disc = +(watchedDiscount || 0);
    return { subtotal: sub, tax: t, grandTotal: sub - disc + t };
  }, [watchedItems, watchedDiscount]);

  const create = useMutation({
    mutationFn: (data: QFormValues) => api.post("/quotations", {
      ...data,
      client_id: Number(data.client_id),
      items: data.items.map((it) => ({
        ...it,
        service_id: it.service_id || undefined,
        quantity: Number(it.quantity),
        rate: Number(it.rate),
        tax_rate: Number(it.tax_rate),
      })),
    }),
    onSuccess: () => { toast.success("Quotation created!"); onSuccess(); },
    onError: () => toast.error("Failed to create quotation"),
  });

  const onSubmit = (values: QFormValues) => {
    if (!values.client_id) return toast.error("Please select a client");
    if (!values.items.length) return toast.error("Add at least one item");
    create.mutate(values);
  };

  const fillFromService = (idx: number, svcId: string) => {
    const svc = services.data?.data.find((s) => String(s.id) === svcId);
    if (!svc) return;
    setValue(`items.${idx}.description`, svc.description?.trim() || svc.name);
    setValue(`items.${idx}.rate`, Number(svc.price ?? 0));
    setValue(`items.${idx}.tax_rate`, Number(svc.gst_rate ?? 0));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Header fields ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {/* Client */}
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label>Client <span className="text-destructive">*</span></Label>
          <Select onValueChange={(v) => setValue("client_id", Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select client…" />
            </SelectTrigger>
            <SelectContent>
              {(clients.data?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quotation Date */}
        <div className="space-y-1.5">
          <Label>Quotation Date</Label>
          <Input type="date" {...register("quotation_date")} />
        </div>

        {/* Valid Until */}
        <div className="space-y-1.5">
          <Label>Valid Until</Label>
          <Input type="date" {...register("valid_until")} />
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select defaultValue="INR" onValueChange={(v) => setValue("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["INR", "USD", "EUR", "GBP", "AED"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Discount */}
        <div className="space-y-1.5">
          <Label>Discount (₹)</Label>
          <Input type="number" min={0} step="0.01" {...register("discount", { valueAsNumber: true })} />
        </div>
      </div>

      {/* ── Line Items ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-base font-semibold">Line Items</Label>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => append({ service_id: "", description: "", quantity: 1, rate: 0, tax_rate: 0 })}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Row
          </Button>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-40">Service</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Rate</TableHead>
                <TableHead className="w-20 text-right">Tax%</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, idx) => {
                const it = watchedItems?.[idx];
                const amt = (+(it?.quantity || 0)) * (+(it?.rate || 0));
                const tax = amt * (+(it?.tax_rate || 0)) / 100;
                return (
                  <TableRow key={field.id}>
                    {/* Service picker */}
                    <TableCell className="py-2 pr-1">
                      <Select
                        value={it?.service_id ? String(it.service_id) : ""}
                        onValueChange={(v) => { setValue(`items.${idx}.service_id`, Number(v)); fillFromService(idx, v); }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Pick…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(services.data?.data ?? []).map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {/* Description */}
                    <TableCell className="py-2 px-1">
                      <Input
                        className="h-8 text-xs"
                        placeholder="Description"
                        {...register(`items.${idx}.description`)}
                      />
                    </TableCell>
                    {/* Qty */}
                    <TableCell className="py-2 px-1">
                      <Input
                        className="h-8 text-xs text-right"
                        type="number" min={1} step="0.01"
                        {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                      />
                    </TableCell>
                    {/* Rate */}
                    <TableCell className="py-2 px-1">
                      <Input
                        className="h-8 text-xs text-right"
                        type="number" min={0} step="0.01"
                        {...register(`items.${idx}.rate`, { valueAsNumber: true })}
                      />
                    </TableCell>
                    {/* Tax */}
                    <TableCell className="py-2 px-1">
                      <Input
                        className="h-8 text-xs text-right"
                        type="number" min={0} step="0.01"
                        {...register(`items.${idx}.tax_rate`, { valueAsNumber: true })}
                      />
                    </TableCell>
                    {/* Amount */}
                    <TableCell className="py-2 pl-1 text-right text-sm font-medium">
                      {formatCurrency(amt + tax)}
                    </TableCell>
                    {/* Remove */}
                    <TableCell className="py-2 pl-0">
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Totals ── */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 rounded-xl border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-red-500">-{formatCurrency(+(watchedDiscount || 0))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between border-t pt-1.5 font-semibold">
            <span>Grand Total</span>
            <span className="text-primary">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Notes / Terms ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            rows={3}
            placeholder="Any notes for the client…"
            className="resize-none text-sm"
            {...register("notes")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Terms & Conditions</Label>
          <Textarea
            rows={3}
            placeholder="Payment terms, conditions…"
            className="resize-none text-sm"
            {...register("terms")}
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending
            ? <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving…</>
            : <><Save className="mr-2 h-4 w-4" />Create Quotation</>}
        </Button>
      </div>
    </form>
  );
}
