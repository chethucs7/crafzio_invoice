import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import type { Client, Service, InvoiceItem, Invoice } from "@/lib/types";

export interface InvoiceFormValues {
  client_id: number;
  invoice_date: string;
  due_date: string;
  currency: string;
  payment_terms: string;
  notes: string;
  terms: string;
  discount: number;
  extra_charges: number;
  round_off: number;
  igst: number;
  items: InvoiceItem[];
  authorized_signatory?: string;
}

export function InvoiceForm({
  initial,
  submitLabel = "Save invoice",
  onSubmit,
  onSaveDraft,
  onCancel,
}: {
  initial?: Partial<Invoice> & { items?: InvoiceItem[] };
  submitLabel?: string;
  onSubmit: (v: InvoiceFormValues) => void;
  onSaveDraft?: (v: InvoiceFormValues) => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [openServiceIndex, setOpenServiceIndex] = useState<number | null>(null);
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

  const signatories = useMemo(() => {
    const sig = company.data?.signature;
    if (!sig || typeof sig !== "string") return [];
    return sig.split(",").map((s) => s.trim()).filter(Boolean);
  }, [company.data?.signature]);

  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 15 * 86400_000).toISOString().slice(0, 10);

  const { register, control, handleSubmit, setValue, reset, watch } = useForm<InvoiceFormValues>({
    defaultValues: {
      client_id: initial?.client_id ?? 0,
      invoice_date: initial?.invoice_date ?? today,
      due_date: initial?.due_date ?? due,
      currency: initial?.currency ?? "INR",
      payment_terms: initial?.payment_terms ?? "Net 15",
      notes: initial?.notes ?? "",
      terms: initial?.terms ?? "",
      discount: Number(initial?.discount ?? 0),
      extra_charges: Number(initial?.extra_charges ?? 0),
      round_off: Number(initial?.round_off ?? 0),
      igst: Number(initial?.igst ?? 0),
      authorized_signatory: initial?.authorized_signatory ?? "",
      items: initial?.items?.length
        ? initial.items.map((i) => ({ ...i }))
        : [{ description: "", quantity: 1, rate: 0, tax_rate: 0, unit: "Nos" }],
    },
  });

  useEffect(() => {
    if (initial) {
      reset({
        client_id: initial.client_id ?? 0,
        invoice_date: initial.invoice_date ?? today,
        due_date: initial.due_date ?? due,
        currency: initial.currency ?? "INR",
        payment_terms: initial.payment_terms ?? "Net 15",
        notes: initial.notes ?? "",
        terms: initial.terms ?? "",
        discount: Number(initial.discount ?? 0),
        extra_charges: Number(initial.extra_charges ?? 0),
        round_off: Number(initial.round_off ?? 0),
        igst: Number(initial.igst ?? 0),
        authorized_signatory: initial.authorized_signatory ?? "",
        items: initial.items?.length
          ? initial.items.map((i) => ({ ...i }))
          : [{ description: "", quantity: 1, rate: 0, tax_rate: 0, unit: "Nos" }],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" }) as InvoiceItem[];
  const discount = useWatch({ control, name: "discount" }) || 0;
  const extra = useWatch({ control, name: "extra_charges" }) || 0;
  const round = useWatch({ control, name: "round_off" }) || 0;
  const clientId = watch("client_id");

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    for (const it of items ?? []) {
      const line = (Number(it?.quantity) || 0) * (Number(it?.rate) || 0) - (Number(it?.discount) || 0);
      sub += line;
      tax += (line * (Number(it?.tax_rate) || 0)) / 100;
    }
    const total = sub - Number(discount) + tax + Number(extra) + Number(round);
    return { sub, tax, total };
  }, [items, discount, extra, round]);

  const applyService = (idx: number, sid: string) => {
    const s = services.data?.data.find((x) => x.id === Number(sid));
    if (!s) return;
    setValue(`items.${idx}.service_id`, s.id);
    setValue(`items.${idx}.description`, s.description?.trim() || s.name);
    setValue(`items.${idx}.rate`, Number(s.price));
    setValue(`items.${idx}.tax_rate`, Number(s.gst_rate ?? 0));
    setValue(`items.${idx}.unit`, s.unit ?? "Nos");
  };

  const createService = useMutation({
    mutationFn: (value: Pick<Service, "name" | "description" | "price" | "gst_rate" | "unit">) =>
      api.post("/services", value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services-all"] });
      setServiceDialogOpen(false);
    },
  });

  const { register: registerService, handleSubmit: handleServiceSubmit, reset: resetService } = useForm<Pick<Service, "name" | "description" | "price" | "gst_rate" | "unit">>({
    defaultValues: { name: "", description: "", price: 0, gst_rate: 18, unit: "Nos" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-2 space-y-1.5">
          <Label>Client *</Label>
          <Select value={clientId ? String(clientId) : ""} onValueChange={(v) => setValue("client_id", Number(v))}>
            <SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger>
            <SelectContent>
              {clients.data?.data.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}{c.company_name ? ` · ${c.company_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Invoice date</Label><Input type="date" {...register("invoice_date")} /></div>
        <div className="space-y-1.5"><Label>Due date</Label><Input type="date" {...register("due_date")} /></div>
        <div className="space-y-1.5"><Label>Currency</Label><Input {...register("currency")} /></div>
        <div className="space-y-1.5"><Label>Payment terms</Label><Input {...register("payment_terms")} /></div>
        <div className="space-y-1.5"><Label>IGST (₹)</Label><Input type="number" step="0.01" {...register("igst", { valueAsNumber: true })} /></div>
        <div className="space-y-1.5">
          <Label>Authorized Signatory</Label>
          <Select
            value={watch("authorized_signatory") || ""}
            onValueChange={(v) => setValue("authorized_signatory", v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select signatory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {signatories.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-semibold">Services / Items</h3>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => {
              const newIndex = fields.length;
              append(
                { description: "", quantity: 1, rate: 0, tax_rate: 0, unit: "Nos" },
                { focusName: `items.${newIndex}.service_id` },
              );
              requestAnimationFrame(() => setOpenServiceIndex(newIndex));
            }}
          >
            <Plus className="mr-1 h-3 w-3" />Add service
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { resetService(); setServiceDialogOpen(true); }}>
            <Plus className="mr-1 h-3 w-3" />New service
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Service</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-right w-20">Qty</th>
                <th className="p-3 text-right w-28">Rate</th>
                <th className="p-3 text-right w-24">Disc</th>
                <th className="p-3 text-right w-20">Tax %</th>
                <th className="p-3 text-right w-28">Amount</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((f, idx) => {
                const it = items?.[idx];
                const line = ((Number(it?.quantity) || 0) * (Number(it?.rate) || 0) - (Number(it?.discount) || 0));
                const amt = line + (line * (Number(it?.tax_rate) || 0)) / 100;
                const sid = it?.service_id;
                return (
                  <tr key={f.id}>
                    <td className="p-2">
                      <Select
                        value={sid ? String(sid) : ""}
                        open={openServiceIndex === idx}
                        onOpenChange={(open) => setOpenServiceIndex(open ? idx : null)}
                        onValueChange={(v) => applyService(idx, v)}
                      >
                        <SelectTrigger name={`items.${idx}.service_id`} className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {services.data?.data.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2"><Input {...register(`items.${idx}.description` as const)} /></td>
                    <td className="p-2"><Input className="text-right" type="number" step="0.01" {...register(`items.${idx}.quantity` as const, { valueAsNumber: true })} /></td>
                    <td className="p-2"><Input className="text-right" type="number" step="0.01" {...register(`items.${idx}.rate` as const, { valueAsNumber: true })} /></td>
                    <td className="p-2"><Input className="text-right" type="number" step="0.01" {...register(`items.${idx}.discount` as const, { valueAsNumber: true })} /></td>
                    <td className="p-2"><Input className="text-right" type="number" step="0.01" {...register(`items.${idx}.tax_rate` as const, { valueAsNumber: true })} /></td>
                    <td className="p-2 text-right font-medium">{formatCurrency(amt)}</td>
                    <td className="p-2 text-center">
                      <Button variant="ghost" size="icon" type="button" onClick={() => remove(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={4} {...register("notes")} /></div>
          <div className="space-y-1.5"><Label>Terms</Label><Textarea rows={4} {...register("terms")} /></div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-soft space-y-2 text-sm">
          <Row label="Subtotal" val={formatCurrency(totals.sub)} />
          <div className="grid grid-cols-2 items-center gap-2">
            <span className="text-muted-foreground">Discount (₹)</span>
            <Input type="number" step="0.01" {...register("discount", { valueAsNumber: true })} />
          </div>
          <Row label="Tax" val={formatCurrency(totals.tax)} />
          <div className="grid grid-cols-2 items-center gap-2">
            <span className="text-muted-foreground">Extra charges</span>
            <Input type="number" step="0.01" {...register("extra_charges", { valueAsNumber: true })} />
          </div>
          <div className="grid grid-cols-2 items-center gap-2">
            <span className="text-muted-foreground">Round off</span>
            <Input type="number" step="0.01" {...register("round_off", { valueAsNumber: true })} />
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-3">
            <span className="font-semibold">Grand total</span>
            <span className="text-lg font-semibold text-primary">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        {onSaveDraft && <Button type="button" variant="outline" onClick={handleSubmit(onSaveDraft)}><Save className="mr-2 h-4 w-4" />Save draft</Button>}
        <Button type="submit"><Save className="mr-2 h-4 w-4" />{submitLabel}</Button>
      </div>

      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New service</DialogTitle></DialogHeader>
          <form onSubmit={handleServiceSubmit((value) => createService.mutate(value))} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input required {...registerService("name")} /></div>
            <div className="space-y-1.5"><Label>Price</Label><Input type="number" step="0.01" {...registerService("price", { valueAsNumber: true })} /></div>
            <div className="space-y-1.5"><Label>GST %</Label><Input type="number" step="0.01" {...registerService("gst_rate", { valueAsNumber: true })} /></div>
            <div className="space-y-1.5"><Label>Unit</Label><Input {...registerService("unit")} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Description</Label><Textarea rows={3} {...registerService("description")} /></div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setServiceDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createService.isPending}><Save className="mr-2 h-4 w-4" />Save service</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{val}</span></div>;
}
