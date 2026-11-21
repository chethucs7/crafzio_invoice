import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate } from "@/lib/format";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
});

interface LogRow {
  id: number; user?: string; action?: string; entity?: string; entity_id?: number;
  detail?: string; created_at?: string;
}

function ActivityPage() {
  const { data } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => (await api.get("/activity")).data as { data: LogRow[] },
  });
  return (
    <>
      <PageHeader title="Activity log" description="Everything that happened in the system" />
      <div className="rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No activity yet.</TableCell></TableRow>
            )}
            {data?.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                <TableCell>{r.user || "—"}</TableCell>
                <TableCell><span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.action}</span></TableCell>
                <TableCell>{r.entity}{r.entity_id ? ` #${r.entity_id}` : ""}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
