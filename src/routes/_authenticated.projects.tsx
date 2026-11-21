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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Client } from "@/lib/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

interface Project {
  id: number; name: string; client_id?: number; client?: string;
  start_date?: string; end_date?: string; technology?: string;
  status: string; cost: number; advance_paid: number; pending: number; description?: string;
}

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get("/projects")).data as { data: Project[] },
  });
  const clients = useQuery({
    queryKey: ["clients-all-p"],
    queryFn: async () => (await api.get("/clients", { params: { per_page: 100 } })).data as { data: Client[] },
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="Track project scope, timeline and budget"
        actions={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New project</Button>}
      />
      <div className="rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(projects.data?.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No projects yet.</TableCell></TableRow>
            )}
            {projects.data?.data.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.client}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(p.start_date)} → {formatDate(p.end_date)}
                </TableCell>
                <TableCell>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase", statusColor(p.status))}>
                    {p.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(p.cost)}</TableCell>
                <TableCell className="text-right">{formatCurrency(p.pending)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) del.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NewProjectDialog
        open={open}
        onOpenChange={setOpen}
        clients={clients.data?.data ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["projects"] })}
      />
    </>
  );
}

function NewProjectDialog({ open, onOpenChange, clients, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; clients: Client[]; onSaved: () => void;
}) {
  const { register, handleSubmit, setValue, reset } = useForm<Project>();
  const save = useMutation({
    mutationFn: (v: Project) => api.post("/projects", v),
    onSuccess: () => { toast.success("Created"); onSaved(); onOpenChange(false); reset(); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input required {...register("name")} /></div>
          <div className="col-span-2 space-y-1.5">
            <Label>Client</Label>
            <Select onValueChange={(v) => setValue("client_id", Number(v))}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Start</Label><Input type="date" {...register("start_date")} /></div>
          <div className="space-y-1.5"><Label>End</Label><Input type="date" {...register("end_date")} /></div>
          <div className="space-y-1.5"><Label>Technology</Label><Input {...register("technology")} /></div>
          <div className="space-y-1.5"><Label>Status</Label><Input defaultValue="planning" {...register("status")} /></div>
          <div className="space-y-1.5"><Label>Cost</Label><Input type="number" step="0.01" {...register("cost", { valueAsNumber: true })} /></div>
          <div className="space-y-1.5"><Label>Advance paid</Label><Input type="number" step="0.01" {...register("advance_paid", { valueAsNumber: true })} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Description</Label><Textarea rows={3} {...register("description")} /></div>
          <DialogFooter className="col-span-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
