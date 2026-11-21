import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/company")({
  component: CompanySettingsPage,
});

function CompanySettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await api.get("/company")).data as Record<string, unknown>,
  });
  const { register, handleSubmit, reset } = useForm();
  useEffect(() => { if (data) reset(data); }, [data, reset]);

  const save = useMutation({
    mutationFn: (v: unknown) => api.put("/company", v),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["company"] }); },
  });

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    await api.post("/company/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
    toast.success("Logo uploaded");
    qc.invalidateQueries({ queryKey: ["company"] });
  };

  return (
    <>
      <PageHeader title="Company settings" description="Details used on invoices and PDFs" />
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6">
        <Card title="Branding">
          <Grid>
            <Field label="Company name"><Input {...register("company_name")} /></Field>
            <Field label="Tagline"><Input {...register("tagline")} /></Field>
            <Field label="Business (legal) name"><Input {...register("business_name")} /></Field>
            <Field label="Website"><Input {...register("website")} /></Field>
          </Grid>
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs">Logo</Label>
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
        </Card>
        <Card title="Contact & address">
          <Grid>
            <Field label="Email"><Input type="email" {...register("email")} /></Field>
            <Field label="Phone"><Input {...register("phone")} /></Field>
            <Field label="Alt phone"><Input {...register("alt_phone")} /></Field>
            <Field label="Pincode"><Input {...register("pincode")} /></Field>
            <Field label="City"><Input {...register("city")} /></Field>
            <Field label="State"><Input {...register("state")} /></Field>
            <Field label="Country"><Input {...register("country")} /></Field>
          </Grid>
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs">Street address</Label>
            <Textarea rows={2} {...register("address")} />
          </div>
        </Card>
        <Card title="Tax & compliance">
          <Grid>
            <Field label="GSTIN"><Input {...register("gst_number")} /></Field>
            <Field label="PAN"><Input {...register("pan_number")} /></Field>
            <Field label="UDYAM"><Input {...register("udyam_number")} /></Field>
            <Field label="CIN"><Input {...register("cin_number")} /></Field>
            <Field label="MSME"><Input {...register("msme_number")} /></Field>
          </Grid>
        </Card>
        <Card title="Bank details">
          <Grid>
            <Field label="Bank name"><Input {...register("bank_name")} /></Field>
            <Field label="Account name"><Input {...register("account_name")} /></Field>
            <Field label="Account number"><Input {...register("account_number")} /></Field>
            <Field label="IFSC"><Input {...register("ifsc")} /></Field>
            <Field label="SWIFT"><Input {...register("swift")} /></Field>
            <Field label="UPI ID"><Input {...register("upi_id")} /></Field>
          </Grid>
        </Card>
        <Card title="Invoicing defaults">
          <Grid>
            <Field label="Currency code"><Input {...register("default_currency")} /></Field>
            <Field label="Symbol"><Input {...register("currency_symbol")} /></Field>
            <Field label="Invoice prefix"><Input {...register("invoice_prefix")} /></Field>
            <Field label="Quotation prefix"><Input {...register("quotation_prefix")} /></Field>
            <Field label="Financial year"><Input {...register("financial_year")} /></Field>
            <Field label="Default tax %"><Input type="number" step="0.01" {...register("default_tax", { valueAsNumber: true })} /></Field>
            <Field label="Default payment terms"><Input {...register("default_payment_terms")} /></Field>
            <Field label="Late fee %"><Input type="number" step="0.01" {...register("late_fee_percent", { valueAsNumber: true })} /></Field>
            <Field label="Authorized Signatories (comma-separated)"><Input placeholder="e.g. Chethan S, Chandana" {...register("signature")} /></Field>
          </Grid>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Footer notes"><Textarea rows={3} {...register("footer_notes")} /></Field>
            <Field label="Terms & conditions"><Textarea rows={3} {...register("terms_conditions")} /></Field>
          </div>
        </Card>
        <div className="flex justify-end">
          <Button type="submit"><Save className="mr-2 h-4 w-4" />Save changes</Button>
        </div>
      </form>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
