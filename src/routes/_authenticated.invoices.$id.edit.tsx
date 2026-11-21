import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { InvoiceForm, type InvoiceFormValues } from "@/components/invoice-form";
import type { Invoice } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/invoices/$id/edit")({
  component: EditInvoicePage,
});

function EditInvoicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: inv } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => (await api.get(`/invoices/${id}`)).data as Invoice,
  });
  const save = useMutation({
    mutationFn: (v: InvoiceFormValues) => api.put(`/invoices/${id}`, v),
    onSuccess: () => {
      toast.success("Invoice updated");
      navigate({ to: "/invoices/$id", params: { id } });
    },
  });

  if (!inv) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <>
      <PageHeader
        title={`Edit ${inv.invoice_number}`}
        description="Add, remove or update services and totals"
        actions={
          <Button variant="ghost" asChild>
            <Link to="/invoices/$id" params={{ id }}><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
          </Button>
        }
      />
      <InvoiceForm
        initial={inv}
        submitLabel="Save changes"
        onSubmit={(v) => save.mutate(v)}
        onCancel={() => navigate({ to: "/invoices/$id", params: { id } })}
      />
    </>
  );
}
