import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Copy, Save } from "lucide-react";
import type { Service } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/services/")({
  component: ServicesPage,
});

interface Category { id: number; name: string }

function ServicesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);

  const services = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.get("/services", { params: { per_page: 100 } })).data as { data: Service[] },
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data as { data: Category[] },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/services/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["services"] }); },
  });
  const dup = useMutation({
    mutationFn: (id: number) => api.post(`/services/${id}/duplicate`),
    onSuccess: () => { toast.success("Duplicated"); qc.invalidateQueries({ queryKey: ["services"] }); },
  });

  return (
    <>
      <PageHeader
        title="Services"
        description="Catalog of services you invoice for"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />New service
          </Button>
        }
      />
      <div className="rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>HSN/SAC</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">GST %</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.data?.data.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.category || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{s.hsn_sac || "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(s.price)}</TableCell>
                <TableCell className="text-right">{s.gst_rate}%</TableCell>
                <TableCell>{s.unit}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => dup.mutate(s.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) del.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ServiceDialog
        open={open}
        onOpenChange={setOpen}
        service={editing}
        categories={categories.data?.data ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["services"] })}
      />
    </>
  );
}

function ServiceDialog({
  open, onOpenChange, service, categories, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  service: Service | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<Service>({
    defaultValues: service ?? { name: "", price: 0, gst_rate: 18, unit: "Nos" } as Service,
  });
  const catVal = watch("category_id");

  const save = useMutation({
    mutationFn: async (v: Service) => {
      if (service) return api.put(`/services/${service.id}`, v);
      return api.post("/services", v);
    },
    onSuccess: () => { toast.success("Saved"); onSaved(); onOpenChange(false); reset(); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) reset(service ?? undefined); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "New service"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Name *</Label>
            <Input required {...register("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={catVal ? String(catVal) : ""}
              onValueChange={(v) => setValue("category_id", v ? Number(v) : undefined)}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>HSN / SAC</Label>
            <Input {...register("hsn_sac")} />
          </div>
          <div className="space-y-1.5">
            <Label>Price</Label>
            <Input type="number" step="0.01" {...register("price", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>GST %</Label>
            <Input type="number" step="0.01" {...register("gst_rate", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Input {...register("unit")} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Input {...register("status")} placeholder="active" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} {...register("description")} />
          </div>
          <DialogFooter className="col-span-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit"><Save className="mr-2 h-4 w-4" />Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
