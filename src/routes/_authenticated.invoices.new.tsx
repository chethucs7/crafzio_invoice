import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { InvoiceForm, type InvoiceFormValues } from "@/components/invoice-form";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const navigate = useNavigate();
  const save = useMutation({
    mutationFn: (v: InvoiceFormValues) => api.post("/invoices", { ...v, status: "draft" }),
    onSuccess: (res) => {
      toast.success("Draft saved");
      navigate({ to: "/invoices/$id", params: { id: String(res.data.id) } });
    },
  });

  return (
    <>
      <PageHeader
        title="New invoice"
        description="Create a GST invoice with automatic totals"
        actions={
          <Button variant="ghost" asChild>
            <Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
          </Button>
        }
      />
      <InvoiceForm
        submitLabel="Create invoice"
        onSubmit={(v) => save.mutate(v)}
        onSaveDraft={(v) => save.mutate(v)}
        onCancel={() => navigate({ to: "/invoices" })}
      />
    </>
  );
}
