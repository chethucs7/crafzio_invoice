import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client, Invoice } from "@/lib/types";
import { ArrowLeft, Save, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () =>
      (await api.get(`/clients/${id}`)).data as { client: Client; invoices: Invoice[]; outstanding: number },
  });

  const { register, handleSubmit, reset } = useForm<Client>();
  useEffect(() => { if (data?.client) reset(data.client); }, [data, reset]);

  const save = useMutation({
    mutationFn: (v: Client) => api.put(`/clients/${id}`, v),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["client", id] });
    },
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/clients/${id}`),
    onSuccess: () => { toast.success("Deleted"); navigate({ to: "/clients" }); },
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <>
      <PageHeader
        title={data.client.name}
        description={data.client.company_name || "Client details"}
        actions={
          <>
            <Button variant="ghost" asChild><Link to="/clients"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
            <Button
              variant="outline"
              onClick={() => { if (confirm("Delete this client?")) del.mutate(); }}
            >
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="lg:col-span-2 space-y-6">
          <Section title="Contact">
            <Grid>
              <Field label="Name"><Input {...register("name")} /></Field>
              <Field label="Company"><Input {...register("company_name")} /></Field>
              <Field label="Email"><Input type="email" {...register("email")} /></Field>
              <Field label="Phone"><Input {...register("phone")} /></Field>
              <Field label="WhatsApp"><Input {...register("whatsapp")} /></Field>
              <Field label="Website"><Input {...register("website")} /></Field>
              <Field label="GSTIN"><Input {...register("gst_number")} /></Field>
              <Field label="PAN"><Input {...register("pan")} /></Field>
            </Grid>
          </Section>
          <Section title="Address">
            <Field label="Street"><Textarea rows={3} {...register("address")} /></Field>
            <Grid>
              <Field label="City"><Input {...register("city")} /></Field>
              <Field label="State"><Input {...register("state")} /></Field>
              <Field label="PIN"><Input {...register("pin")} /></Field>
              <Field label="Country"><Input {...register("country")} /></Field>
            </Grid>
          </Section>
          <Section title="Notes">
            <Textarea rows={4} {...register("notes")} />
          </Section>
          <div className="flex justify-end">
            <Button type="submit"><Save className="mr-2 h-4 w-4" />Save changes</Button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-soft">
            <p className="text-xs font-medium uppercase text-muted-foreground">Outstanding</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(data.outstanding)}</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Invoices</h3>
            </div>
            {data.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="divide-y">
                {data.invoices.map((i) => (
                  <Link
                    key={i.id}
                    to="/invoices/$id"
                    params={{ id: String(i.id) }}
                    className="flex items-center justify-between py-2 text-sm hover:text-primary"
                  >
                    <div>
                      <p className="font-medium">{i.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(i.invoice_date)}</p>
                    </div>
                    <div className="text-right">
                      <p>{formatCurrency(i.grand_total)}</p>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase", statusColor(i.status))}>
                        {i.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
