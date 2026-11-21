import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Client } from "@/lib/types";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clients/new")({
  component: NewClientPage,
});

function NewClientPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Client>();

  const onSubmit = async (data: Client) => {
    try {
      const res = await api.post("/clients", data);
      toast.success("Client created");
      navigate({ to: "/clients/$id", params: { id: String(res.data.id) } });
    } catch { /* handled */ }
  };

  return (
    <>
      <PageHeader
        title="New client"
        description="Create a new customer record"
        actions={
          <Button variant="ghost" asChild>
            <Link to="/clients"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
          </Button>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Section title="Contact" desc="Basic identification and channels">
          <Field label="Client name *"><Input required {...register("name")} /></Field>
          <Field label="Company"><Input {...register("company_name")} /></Field>
          <Field label="Contact person"><Input {...register("contact_person")} /></Field>
          <Field label="Email"><Input type="email" {...register("email")} /></Field>
          <Field label="Phone"><Input {...register("phone")} /></Field>
          <Field label="WhatsApp"><Input {...register("whatsapp")} /></Field>
          <Field label="Website"><Input {...register("website")} /></Field>
        </Section>
        <Section title="Tax" desc="Regulatory identifiers used on invoices">
          <Field label="GSTIN"><Input {...register("gst_number")} /></Field>
          <Field label="PAN"><Input {...register("pan")} /></Field>
        </Section>
        <Section title="Address">
          <Field label="Street"><Textarea rows={3} {...register("address")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><Input {...register("city")} /></Field>
            <Field label="State"><Input {...register("state")} /></Field>
            <Field label="PIN"><Input {...register("pin")} /></Field>
            <Field label="Country"><Input defaultValue="India" {...register("country")} /></Field>
          </div>
        </Section>
        <div className="md:col-span-3">
          <Section title="Notes">
            <Field label="Internal notes"><Textarea rows={4} {...register("notes")} /></Field>
          </Section>
        </div>
        <div className="md:col-span-3 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => navigate({ to: "/clients" })}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />Save client
          </Button>
        </div>
      </form>
    </>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <h3 className="text-sm font-semibold">{title}</h3>
      {desc && <p className="mb-4 text-xs text-muted-foreground">{desc}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
