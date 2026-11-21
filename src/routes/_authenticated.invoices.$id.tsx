import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL, auth } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Client, Invoice, InvoiceItem, Payment, Service } from "@/lib/types";
import { formatCurrency, formatDate, statusColor } from "@/lib/format";
import { ArrowLeft, Check, Download, Eye, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: inv } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => (await api.get(`/invoices/${id}`)).data as Invoice,
  });
  const company = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await api.get("/company")).data as Record<string, any>,
  });
  const [payOpen, setPayOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);

  const quickSend = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/email`, {}),
    onSuccess: (r) => {
      if (r.data.ok) toast.success(`Email sent to ${inv?.client_data?.email || inv?.client}`);
      else toast.error(`Send failed: ${r.data.error || "check SMTP settings"}`);
    },
    onError: () => toast.error("Send failed"),
  });

  const deleteInvoice = useMutation({
    mutationFn: () => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      toast.success("Invoice deleted");
      navigate({ to: "/invoices" });
    },
    onError: () => toast.error("Delete failed"),
  });

  const fetchPdfBlob = async () => {
    if (!inv) return null;
    const res = await fetch(`${API_URL}/invoices/${inv.id}/pdf`, {
      headers: { Authorization: `Bearer ${auth.getToken()}` },
    });
    if (!res.ok) { toast.error("PDF failed"); return null; }
    return res.blob();
  };
  const downloadPdf = async () => {
    if (!inv) return;
    const blob = await fetchPdfBlob(); if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${inv.invoice_number}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };
  const previewPdf = async () => {
    const blob = await fetchPdfBlob(); if (!blob) return;
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // revoke later so the tab has time to load
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const delPayment = useMutation({
    mutationFn: (pid: number) => api.delete(`/payments/${pid}`),
    onSuccess: () => { toast.success("Payment removed"); qc.invalidateQueries({ queryKey: ["invoice", id] }); },
  });

  const setStatus = useMutation({
    mutationFn: (s: string) => api.post(`/invoices/${id}/status`, { status: s }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); },
  });

  const patchInvoice = useMutation({
    mutationFn: (patch: Partial<Invoice>) => api.put(`/invoices/${id}`, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoice", id] }); },
    onError: () => toast.error("Update failed"),
  });

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: InvoiceItem; index?: number }>({ open: false });
  const saveItem = (item: InvoiceItem, index?: number) => {
    if (!inv) return;
    const next = [...(inv.items ?? [])];
    if (typeof index === "number") next[index] = item; else next.push(item);
    patchInvoice.mutate({ items: next } as Partial<Invoice>, {
      onSuccess: () => { toast.success(typeof index === "number" ? "Item updated" : "Item added"); setItemDialog({ open: false }); },
    });
  };
  const deleteItem = (index: number) => {
    if (!inv || !confirm("Remove this line item?")) return;
    const next = (inv.items ?? []).filter((_, i) => i !== index);
    patchInvoice.mutate({ items: next } as Partial<Invoice>, { onSuccess: () => toast.success("Item removed") });
  };

  if (!inv) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <>
      <PageHeader
        title={inv.invoice_number}
        description={`${inv.client} · ${formatDate(inv.invoice_date)}`}
        actions={
          <>
            <Button variant="ghost" asChild><Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
            <Button variant="outline" asChild>
              <Link to="/invoices/$id/edit" params={{ id: String(inv.id) }}><Pencil className="mr-2 h-4 w-4" />Edit</Link>
            </Button>
            <Button variant="outline" onClick={previewPdf}><Eye className="mr-2 h-4 w-4" />Preview</Button>
            <Button variant="outline" onClick={downloadPdf}><Download className="mr-2 h-4 w-4" />Download</Button>
            <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => {
              if (confirm("Are you sure you want to delete this invoice? This cannot be undone.")) {
                deleteInvoice.mutate();
              }
            }} disabled={deleteInvoice.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
            <Button variant="outline" onClick={() => quickSend.mutate()} disabled={quickSend.isPending}>
              <Mail className="mr-2 h-4 w-4" />{quickSend.isPending ? "Sending…" : "Send email"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEmailOpen(true)} title="Send to a different address">Options…</Button>
            <Button onClick={() => setPayOpen(true)}><Plus className="mr-2 h-4 w-4" />Payment</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Status</p>
                <Select
                  value={inv.status}
                  onValueChange={(v) => setStatus.mutate(v)}
                >
                  <SelectTrigger className={cn("h-8 w-36 rounded-full border px-3 text-xs font-semibold uppercase", statusColor(inv.status))}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-muted-foreground">Grand total</p>
                <p className="text-2xl font-semibold text-primary">{formatCurrency(inv.grand_total)}</p>
              </div>
            </div>
            {(() => {
              const hasLineDiscounts = inv.items?.some((it) => Number(it.discount) > 0);
              return (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">Description</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Rate</th>
                      {hasLineDiscounts && <th className="p-3 text-right">Disc</th>}
                      <th className="p-3 text-right">Tax</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inv.items?.map((it, idx) => (
                      <tr key={it.id ?? idx} className="group">
                        <td className="p-3">{it.description}</td>
                        <td className="p-3 text-right">{it.quantity} {it.unit}</td>
                        <td className="p-3 text-right">{formatCurrency(it.rate)}</td>
                        {hasLineDiscounts && (
                          <td className="p-3 text-right text-muted-foreground">
                            {Number(it.discount) > 0 ? formatCurrency(it.discount) : "—"}
                          </td>
                        )}
                        <td className="p-3 text-right">{it.tax_rate}%</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(it.amount ?? 0)}</td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100">
                            <Button variant="ghost" size="icon" title="Edit"
                              onClick={() => setItemDialog({ open: true, item: it, index: idx })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Delete" onClick={() => deleteItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!inv.items || inv.items.length === 0) && (
                      <tr>
                        <td colSpan={hasLineDiscounts ? 7 : 6} className="p-4 text-center text-xs text-muted-foreground">
                          No line items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              );
            })()}
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setItemDialog({ open: true })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Add service
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 text-sm">
              <div className="space-y-3">
                <EditableTextBlock
                  label="Notes"
                  placeholder="Add a custom note for this client (thank-you message, payment instructions, delivery details…)"
                  value={inv.notes ?? ""}
                  onSave={(v) => patchInvoice.mutate({ notes: v } as Partial<Invoice>, { onSuccess: () => toast.success("Notes saved") })}
                />
                <EditableTextBlock
                  label="Terms & conditions"
                  placeholder="Add terms (late fee, warranty, refund policy…)"
                  value={inv.terms ?? ""}
                  onSave={(v) => patchInvoice.mutate({ terms: v } as Partial<Invoice>, { onSuccess: () => toast.success("Terms saved") })}
                />
              </div>
              <div className="space-y-1">
                <EditableRow label="Subtotal" value={Number(inv.subtotal)}
                  onSave={(v) => patchInvoice.mutate({ subtotal: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Subtotal updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })} />
                
                {(Number(inv.discount) > 0 || activeField === "discount") && (
                  <EditableRow label="Discount" value={Number(inv.discount)}
                    isEditingExternal={activeField === "discount"}
                    onStartEditing={() => setActiveField("discount")}
                    onCancelEditing={() => setActiveField(null)}
                    onSave={(v) => patchInvoice.mutate({ discount: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Discount updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); setActiveField(null); } })} />
                )}

                {(Number(inv.cgst) > 0 || Number(inv.sgst) > 0 || activeField === "cgst" || activeField === "sgst") && (
                  <>
                    <EditableRow label="CGST" value={Number(inv.cgst)}
                      isEditingExternal={activeField === "cgst"}
                      onStartEditing={() => setActiveField("cgst")}
                      onCancelEditing={() => setActiveField(null)}
                      onSave={(v) => patchInvoice.mutate({ cgst: v } as Partial<Invoice>, { onSuccess: () => { toast.success("CGST updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); setActiveField(null); } })} />
                    <EditableRow label="SGST" value={Number(inv.sgst)}
                      isEditingExternal={activeField === "sgst"}
                      onStartEditing={() => setActiveField("sgst")}
                      onCancelEditing={() => setActiveField(null)}
                      onSave={(v) => patchInvoice.mutate({ sgst: v } as Partial<Invoice>, { onSuccess: () => { toast.success("SGST updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); setActiveField(null); } })} />
                  </>
                )}

                {(Number(inv.igst) > 0 || activeField === "igst") && (
                  <EditableRow label="IGST" value={Number(inv.igst)}
                    isEditingExternal={activeField === "igst"}
                    onStartEditing={() => setActiveField("igst")}
                    onCancelEditing={() => setActiveField(null)}
                    onSave={(v) => patchInvoice.mutate({ igst: v } as Partial<Invoice>, { onSuccess: () => { toast.success("IGST updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); setActiveField(null); } })} />
                )}

                {(Number(inv.extra_charges) > 0 || activeField === "extra_charges") && (
                  <EditableRow label="Extra" value={Number(inv.extra_charges)}
                    isEditingExternal={activeField === "extra_charges"}
                    onStartEditing={() => setActiveField("extra_charges")}
                    onCancelEditing={() => setActiveField(null)}
                    onSave={(v) => patchInvoice.mutate({ extra_charges: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Extra updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); setActiveField(null); } })} />
                )}

                {(Number(inv.round_off) !== 0 || activeField === "round_off") && (
                  <EditableRow label="Round off" value={Number(inv.round_off)} allowNegative
                    isEditingExternal={activeField === "round_off"}
                    onStartEditing={() => setActiveField("round_off")}
                    onCancelEditing={() => setActiveField(null)}
                    onSave={(v) => patchInvoice.mutate({ round_off: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Round off updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); setActiveField(null); } })} />
                )}

                <EditableRow label="Total" value={Number(inv.grand_total)} className="group flex items-center justify-between border-t pt-2 font-semibold text-sm"
                  onSave={(v) => patchInvoice.mutate({ grand_total: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Total updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })} />
                
                <EditableRow label="Paid" value={Number(inv.amount_paid)}
                  onSave={(v) => patchInvoice.mutate({ amount_paid: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Paid updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })} />
                
                <div className="flex justify-between font-semibold text-primary"><span>Balance</span><span>{formatCurrency(inv.balance_due)}</span></div>

                {/* On-demand Add buttons */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed pt-3 text-[10px]">
                  {Number(inv.discount) === 0 && activeField !== "discount" && (
                    <button type="button" onClick={() => setActiveField("discount")}
                      className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition">+ Discount</button>
                  )}
                  {Number(inv.cgst) === 0 && Number(inv.sgst) === 0 && activeField !== "cgst" && activeField !== "sgst" && (
                    <button type="button" onClick={() => setActiveField("cgst")}
                      className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition">+ CGST/SGST</button>
                  )}
                  {Number(inv.igst) === 0 && activeField !== "igst" && (
                    <button type="button" onClick={() => setActiveField("igst")}
                      className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition">+ IGST</button>
                  )}
                  {Number(inv.extra_charges) === 0 && activeField !== "extra_charges" && (
                    <button type="button" onClick={() => setActiveField("extra_charges")}
                      className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition">+ Extra</button>
                  )}
                  {Number(inv.round_off) === 0 && activeField !== "round_off" && (
                    <button type="button" onClick={() => setActiveField("round_off")}
                      className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition">+ Round off</button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end border-t pt-4">
              <div className="text-right space-y-1">
                {inv.authorized_signatory && (
                  <p className="text-xs text-muted-foreground">For <span className="font-semibold">{company.data?.company_name || "the Company"}</span></p>
                )}
                <div className="h-12 flex items-end justify-end">
                  {inv.authorized_signatory ? (
                    <span className="font-medium text-sm border-b border-muted-foreground pb-1 px-4">{inv.authorized_signatory}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No authorized signatory selected</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Authorized Signature</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold">Payments</h3>
            {(inv.payments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded.</p>
            ) : (
              <div className="divide-y">
                {inv.payments!.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{formatCurrency(p.amount)} — {p.method || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.payment_date)}{p.transaction_id ? ` · ${p.transaction_id}` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remove?")) delPayment.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold">Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("sent")}>Mark sent</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("paid")}>Mark paid</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("overdue")}>Overdue</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("cancelled")}>Cancel</Button>
            </div>
            <div className="mt-4 border-t pt-4">
              <Button size="sm" variant="destructive" className="w-full" onClick={() => {
                if (confirm("Are you sure you want to delete this invoice? This cannot be undone.")) {
                  deleteInvoice.mutate();
                }
              }} disabled={deleteInvoice.isPending}>
                <Trash2 className="mr-2 h-4 w-4" />Delete Invoice
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-soft space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Invoice Details</h3>
            <div className="space-y-3 text-sm">
              <EditableTextRow
                label="Invoice Number"
                value={inv.invoice_number}
                onSave={(v) => patchInvoice.mutate({ invoice_number: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Invoice number updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })}
              />
              <EditableClientRow
                label="Client"
                value={inv.client_id}
                clientName={inv.client_data?.name || inv.client || ""}
                onSave={(v) => patchInvoice.mutate({ client_id: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Client updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })}
              />
              <EditableDateRow
                label="Invoice Date"
                value={inv.invoice_date}
                onSave={(v) => patchInvoice.mutate({ invoice_date: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Invoice date updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })}
              />
              <EditableDateRow
                label="Due Date"
                value={inv.due_date || ""}
                onSave={(v) => patchInvoice.mutate({ due_date: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Due date updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })}
              />
              <EditableTextRow
                label="Payment Terms"
                value={inv.payment_terms || ""}
                onSave={(v) => patchInvoice.mutate({ payment_terms: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Payment terms updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })}
              />
              <EditableTextRow
                label="Currency"
                value={inv.currency}
                onSave={(v) => patchInvoice.mutate({ currency: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Currency updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })}
              />
              <EditableSignatoryRow
                label="Authorized Signatory"
                value={inv.authorized_signatory || ""}
                onSave={(v) => patchInvoice.mutate({ authorized_signatory: v } as Partial<Invoice>, { onSuccess: () => { toast.success("Signatory updated"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } })}
              />
            </div>
          </div>
        </div>
      </div>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} invoiceId={inv.id} balance={inv.balance_due} onSaved={() => qc.invalidateQueries({ queryKey: ["invoice", id] })} />
      <EmailDialog open={emailOpen} onOpenChange={setEmailOpen} invoiceId={inv.id} defaultTo={inv.client_data?.email || ""} />
      <ItemDialog
        open={itemDialog.open}
        onOpenChange={(o) => setItemDialog(o ? itemDialog : { open: false })}
        initial={itemDialog.item}
        onSave={(it) => saveItem(it, itemDialog.index)}
      />
    </>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{val}</span></div>;
}

function EditableTextBlock({ label, value, placeholder, onSave }: {
  label: string; value: string; placeholder?: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  if (!editing) {
    return (
      <div className="group rounded-md border border-dashed p-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{label}</p>
          <button type="button" onClick={() => setEditing(true)}
            className="text-xs text-primary opacity-0 transition group-hover:opacity-100">
            <Pencil className="mr-1 inline h-3 w-3" />Edit
          </button>
        </div>
        {value ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{value}</p>
        ) : (
          <button type="button" onClick={() => setEditing(true)}
            className="text-xs italic text-muted-foreground hover:text-primary">
            + {placeholder || `Add ${label.toLowerCase()}`}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide">{label}</p>
      <Textarea rows={4} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} autoFocus />
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => { setV(value ?? ""); setEditing(false); }}>
          <X className="mr-1 h-3.5 w-3.5" />Cancel
        </Button>
        <Button size="sm" onClick={() => { onSave(v.trim()); setEditing(false); }}>
          <Check className="mr-1 h-3.5 w-3.5" />Save
        </Button>
      </div>
    </div>
  );
}

function EditableRow({
  label,
  value,
  onSave,
  allowNegative = false,
  className = "group flex items-center justify-between",
  isEditingExternal,
  onStartEditing,
  onCancelEditing,
}: {
  label: string;
  value: number;
  onSave: (v: number) => void;
  allowNegative?: boolean;
  className?: string;
  isEditingExternal?: boolean;
  onStartEditing?: () => void;
  onCancelEditing?: () => void;
}) {
  const [editingInternal, setEditingInternal] = useState(false);
  const editing = isEditingExternal !== undefined ? isEditingExternal : editingInternal;
  const setEditing = (val: boolean) => {
    if (isEditingExternal !== undefined) {
      if (val) onStartEditing?.();
      else onCancelEditing?.();
    } else {
      setEditingInternal(val);
    }
  };

  const [v, setV] = useState(String(value ?? 0));
  useEffect(() => { setV(String(value ?? 0)); }, [value]);

  if (!editing) {
    return (
      <div className={className}>
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span>{formatCurrency(value)}</span>
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button type="button" onClick={() => setEditing(true)}
              className="p-0.5 hover:text-primary" title={`Edit ${label}`}>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
            <button type="button" onClick={() => { if (confirm(`Reset ${label} to 0?`)) { onSave(0); setEditing(false); } }}
              className="p-0.5 hover:text-destructive text-muted-foreground" title={`Reset ${label}`}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          </div>
        </div>
      </div>
    );
  }
  const commit = () => {
    const n = parseFloat(v);
    if (Number.isNaN(n)) { toast.error("Invalid number"); return; }
    if (!allowNegative && n < 0) { toast.error("Must be ≥ 0"); return; }
    onSave(n);
    setEditing(false);
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Input type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="h-7 w-24 text-right" autoFocus />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commit}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function ItemDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: InvoiceItem; onSave: (it: InvoiceItem) => void;
}) {
  const services = useQuery({
    queryKey: ["services-lookup"],
    queryFn: async () => (await api.get("/services", { params: { per_page: 200 } })).data.data as Service[],
    enabled: open,
  });
  const { register, handleSubmit, reset, setValue, watch } = useForm<InvoiceItem>({
    defaultValues: initial ?? { description: "", quantity: 1, unit: "Nos", rate: 0, tax_rate: 0, discount: 0 },
  });
  useEffect(() => {
    if (open) reset(initial ?? { description: "", quantity: 1, unit: "Nos", rate: 0, tax_rate: 0, discount: 0 });
  }, [open, initial, reset]);

  const onPickService = (sid: string) => {
    const s = services.data?.find((x) => String(x.id) === sid);
    if (!s) return;
    setValue("service_id", s.id);
    setValue("description", s.name + (s.description ? ` — ${s.description}` : ""));
    setValue("rate", s.price);
    if (s.unit) setValue("unit", s.unit);
  };

  const qty = Number(watch("quantity") || 0);
  const rate = Number(watch("rate") || 0);
  const tax = Number(watch("tax_rate") || 0);
  const disc = Number(watch("discount") || 0);
  const base = qty * rate - disc;
  const preview = base + base * (tax / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Edit line item" : "Add line item"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => onSave({ ...v, quantity: Number(v.quantity), rate: Number(v.rate), tax_rate: Number(v.tax_rate), discount: Number(v.discount || 0) }))} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Pick from services (optional)</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue=""
              onChange={(e) => onPickService(e.target.value)}
            >
              <option value="">— Select a service —</option>
              {services.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {formatCurrency(s.price)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} {...register("description", { required: true })} /></div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1.5"><Label>Qty</Label><Input type="number" step="0.01" {...register("quantity", { valueAsNumber: true })} /></div>
            <div className="space-y-1.5"><Label>Unit</Label><Input {...register("unit")} /></div>
            <div className="space-y-1.5"><Label>Rate</Label><Input type="number" step="0.01" {...register("rate", { valueAsNumber: true })} /></div>
            <div className="space-y-1.5"><Label>Tax %</Label><Input type="number" step="0.01" {...register("tax_rate", { valueAsNumber: true })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Discount</Label><Input type="number" step="0.01" {...register("discount", { valueAsNumber: true })} /></div>
          <div className="rounded-md bg-muted p-3 text-right text-sm">
            Line total: <span className="font-semibold">{formatCurrency(preview)}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initial ? "Update item" : "Add item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange, invoiceId, balance, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; invoiceId: number; balance: number; onSaved: () => void;
}) {
  const { register, handleSubmit, reset } = useForm<Payment>({
    defaultValues: { amount: balance, payment_date: new Date().toISOString().slice(0, 10), method: "bank_transfer" } as Payment,
  });
  const create = useMutation({
    mutationFn: (v: Payment) => api.post("/payments", { ...v, invoice_id: invoiceId }),
    onSuccess: () => { toast.success("Payment saved"); onSaved(); onOpenChange(false); reset(); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" {...register("payment_date")} /></div>
          </div>
          <div className="space-y-1.5"><Label>Method</Label><Input {...register("method")} placeholder="bank_transfer, upi, cash…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Transaction ID</Label><Input {...register("transaction_id")} /></div>
            <div className="space-y-1.5"><Label>Reference</Label><Input {...register("reference_number")} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} {...register("notes")} /></div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmailDialog({ open, onOpenChange, invoiceId, defaultTo = "" }: {
  open: boolean; onOpenChange: (o: boolean) => void; invoiceId: number; defaultTo?: string;
}) {
  const { register, handleSubmit } = useForm<{ to: string; cc: string; bcc: string }>({
    values: { to: defaultTo, cc: "", bcc: "" },
  });
  const send = useMutation({
    mutationFn: (v: { to: string; cc: string; bcc: string }) => api.post(`/invoices/${invoiceId}/email`, {
      to: v.to, cc: v.cc ? v.cc.split(",") : undefined, bcc: v.bcc ? v.bcc.split(",") : undefined,
    }),
    onSuccess: (r) => {
      if (r.data.ok) {
        toast.success("Email sent");
      } else {
        toast.error(`Failed: ${r.data.error || "check SMTP settings"}`);
      }
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Email invoice</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => send.mutate(v))} className="space-y-3">
          <div className="space-y-1.5"><Label>To</Label><Input required type="email" {...register("to")} placeholder="Leave empty to use client email" /></div>
          <div className="space-y-1.5"><Label>CC (comma-separated)</Label><Input {...register("cc")} /></div>
          <div className="space-y-1.5"><Label>BCC (comma-separated)</Label><Input {...register("bcc")} /></div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Send</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditableTextRow({ label, value, onSave }: {
  label: string; value: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);

  const commit = () => {
    onSave(v.trim());
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group flex items-center justify-between py-1.5 border-b border-dashed border-muted/20">
        <span className="text-muted-foreground font-medium text-xs">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs">{value || "—"}</span>
          <button type="button" onClick={() => setEditing(true)}
            className="opacity-0 transition group-hover:opacity-100" title={`Edit ${label}`}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-muted-foreground font-medium text-xs">{label}</span>
      <div className="flex items-center gap-1">
        <Input value={v} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="h-7 w-32 text-xs" autoFocus />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commit}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function EditableDateRow({ label, value, onSave }: {
  label: string; value: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);

  const commit = () => {
    onSave(v);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group flex items-center justify-between py-1.5 border-b border-dashed border-muted/20">
        <span className="text-muted-foreground font-medium text-xs">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs">{value ? formatDate(value) : "—"}</span>
          <button type="button" onClick={() => setEditing(true)}
            className="opacity-0 transition group-hover:opacity-100" title={`Edit ${label}`}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-muted-foreground font-medium text-xs">{label}</span>
      <div className="flex items-center gap-1">
        <Input type="date" value={v} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="h-7 w-32 px-1 text-xs" autoFocus />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commit}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function EditableClientRow({ label, value, clientName, onSave }: {
  label: string; value: number; clientName: string; onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value ?? ""));
  useEffect(() => { setV(String(value ?? "")); }, [value]);

  const clients = useQuery({
    queryKey: ["clients-lookup-list"],
    queryFn: async () => (await api.get("/clients", { params: { per_page: 200 } })).data.data as Client[],
    enabled: editing,
  });

  const commit = () => {
    if (v) {
      onSave(Number(v));
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <div className="group flex items-center justify-between py-1.5 border-b border-dashed border-muted/20">
        <span className="text-muted-foreground font-medium text-xs">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs">{clientName || "—"}</span>
          <button type="button" onClick={() => setEditing(true)}
            className="opacity-0 transition group-hover:opacity-100" title={`Edit ${label}`}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 py-1.5 border-b border-dashed border-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-medium text-xs">{label}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commit}><Check className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <Select value={v} onValueChange={(val) => setV(val)}>
        <SelectTrigger className="h-8 text-[10px]">
          <SelectValue placeholder="Select client" />
        </SelectTrigger>
        <SelectContent>
          {clients.data?.map((c) => (
            <SelectItem key={c.id} value={String(c.id)} className="text-[10px]">
              {c.name}{c.company_name ? ` · ${c.company_name}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EditableSignatoryRow({ label, value, onSave }: {
  label: string; value: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);

  const company = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await api.get("/company")).data as Record<string, any>,
    enabled: editing,
  });

  const signatories = useMemo(() => {
    const sig = company.data?.signature;
    if (!sig || typeof sig !== "string") return [];
    return sig.split(",").map((s) => s.trim()).filter(Boolean);
  }, [company.data?.signature]);

  const commit = () => {
    onSave(v);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group flex items-center justify-between py-1.5 border-b border-dashed border-muted/20">
        <span className="text-muted-foreground font-medium text-xs">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs">{value || "—"}</span>
          <button type="button" onClick={() => setEditing(true)}
            className="opacity-0 transition group-hover:opacity-100" title={`Edit ${label}`}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 py-1.5 border-b border-dashed border-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-medium text-xs">{label}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commit}><Check className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <Select value={v} onValueChange={(val) => setV(val === "none" ? "" : val)}>
        <SelectTrigger className="h-8 text-[10px]">
          <SelectValue placeholder="Select signatory" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" className="text-[10px]">— None —</SelectItem>
          {signatories.map((name) => (
            <SelectItem key={name} value={name} className="text-[10px]">
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
