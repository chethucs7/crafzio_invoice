import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Archive } from "lucide-react";
import { useState } from "react";
import type { Client } from "@/lib/types";
import { formatDate, statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsPage,
});

function ClientsPage() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => (await api.get("/clients", { params: { q } })).data as { data: Client[] },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      toast.success("Client deleted");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
  const archive = useMutation({
    mutationFn: (id: number) => api.post(`/clients/${id}/archive`),
    onSuccess: () => {
      toast.success("Client archived");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Manage your customers and contacts"
        actions={
          <Button asChild>
            <Link to="/clients/new"><Plus className="mr-2 h-4 w-4" />New client</Link>
          </Button>
        }
      />
      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-md border bg-card px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, GST…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-0 focus-visible:ring-0"
        />
      </div>
      <div className="rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {data?.data.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No clients yet.</TableCell></TableRow>
            )}
            {data?.data.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <Link to="/clients/$id" params={{ id: String(c.id) }} className="hover:text-primary">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.company_name || "—"}</TableCell>
                <TableCell>{c.email || "—"}</TableCell>
                <TableCell>{c.phone || "—"}</TableCell>
                <TableCell>
                  <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase", statusColor(c.status))}>
                    {c.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to="/clients/$id" params={{ id: String(c.id) }}><Pencil className="h-4 w-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => archive.mutate(c.id)}>
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => { if (confirm(`Delete ${c.name}?`)) del.mutate(c.id); }}
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
    </>
  );
}
