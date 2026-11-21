import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Inbox, Send, RefreshCw, PenSquare, Loader2, Trash2,
  Reply, X, Paperclip, ChevronLeft, AlertCircle, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/emails")({
  component: EmailsPage,
});

interface SentLog {
  id: number; to_email: string; subject: string;
  template: string; status: string; error?: string; created_at: string;
}
interface InboxItem {
  id: string; from: string; to: string;
  subject: string; date: string; body_html?: string; body_plain?: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function extractEmail(addr: string) {
  const m = addr.match(/<(.+?)>/);
  return m ? m[1] : addr.trim();
}
function fmtDate(raw: string) {
  try { return new Date(raw).toLocaleString(); } catch { return raw; }
}
function initials(from: string) {
  const name = from.replace(/<.*>/, "").trim();
  return name.slice(0, 2).toUpperCase() || "?";
}

// ─── main page ───────────────────────────────────────────────────────────────
function EmailsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [openMsg, setOpenMsg] = useState<InboxItem | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyDefaults, setReplyDefaults] = useState<{ to: string; subject: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inbox = useQuery({
    queryKey: ["smtp-inbox"],
    queryFn: async () => (await api.get("/smtp/inbox?limit=50")).data as { ok: boolean; error?: string; data: InboxItem[] },
  });
  const sent = useQuery({
    queryKey: ["smtp-logs"],
    queryFn: async () => (await api.get("/smtp/logs")).data.data as SentLog[],
  });

  const msgQuery = useQuery({
    queryKey: ["smtp-inbox-msg", openMsg?.id],
    queryFn: async () => (await api.get(`/smtp/inbox/${openMsg!.id}`)).data as { ok: boolean; data: InboxItem },
    enabled: !!openMsg?.id,
  });

  const deleteMsg = useMutation({
    mutationFn: (id: string) => api.post(`/smtp/inbox/${id}/delete`),
    onSuccess: (r, id) => {
      if (r.data.ok) {
        toast.success("Message deleted");
        setOpenMsg(null);
        qc.setQueryData(["smtp-inbox"], (old: any) => ({
          ...old, data: (old?.data ?? []).filter((m: InboxItem) => m.id !== id),
        }));
      } else {
        toast.error(r.data.error || "Delete failed");
      }
    },
    onError: () => toast.error("Delete failed"),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["smtp-inbox"] });
    qc.invalidateQueries({ queryKey: ["smtp-logs"] });
  };

  const handleReply = (msg: InboxItem) => {
    const full = msgQuery.data?.data ?? msg;
    setReplyDefaults({
      to: extractEmail(full.from),
      subject: full.subject.startsWith("Re:") ? full.subject : `Re: ${full.subject}`,
    });
    setOpenMsg(null);
    setComposeOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this message?")) return;
    setDeletingId(id);
    deleteMsg.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col overflow-hidden">
      <PageHeader
        title="Emails"
        description="All outgoing and incoming email activity"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => { setReplyDefaults(null); setComposeOpen(true); }}>
              <PenSquare className="mr-1.5 h-3.5 w-3.5" /> Compose
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 gap-0 overflow-hidden rounded-xl border bg-card shadow-soft">
        {/* ── Sidebar ── */}
        <aside className="flex w-48 flex-col border-r bg-muted/30 p-3 gap-1 shrink-0">
          <SidebarBtn active={tab === "inbox"} onClick={() => { setTab("inbox"); setOpenMsg(null); }}>
            <Inbox className="h-4 w-4" />
            Inbox
            {(inbox.data?.data?.length ?? 0) > 0 && (
              <span className="ml-auto rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-white">
                {inbox.data?.data?.length}
              </span>
            )}
          </SidebarBtn>
          <SidebarBtn active={tab === "sent"} onClick={() => { setTab("sent"); setOpenMsg(null); }}>
            <Send className="h-4 w-4" />
            Sent
            {(sent.data?.length ?? 0) > 0 && (
              <span className="ml-auto rounded-full bg-muted-foreground/30 px-1.5 py-px text-[10px] font-bold">
                {sent.data?.length}
              </span>
            )}
          </SidebarBtn>
        </aside>

        {/* ── Email List ── */}
        <div className={cn("flex flex-col border-r overflow-y-auto", openMsg ? "w-80 shrink-0" : "flex-1")}>
          {tab === "inbox" ? (
            <>
              {inbox.isLoading && (
                <div className="flex flex-1 items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              {inbox.data && !inbox.data.ok && (
                <div className="flex items-start gap-3 p-6 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-semibold">Inbox unavailable</p>
                    <p className="text-muted-foreground text-xs mt-1">{inbox.data.error}<br />Configure IMAP in Settings → Email settings.</p>
                  </div>
                </div>
              )}
              {(inbox.data?.data ?? []).map((m) => (
                <EmailRow
                  key={m.id}
                  msg={m}
                  active={openMsg?.id === m.id}
                  deleting={deletingId === m.id}
                  onOpen={() => setOpenMsg(m)}
                  onDelete={() => handleDelete(m.id)}
                />
              ))}
              {!inbox.isLoading && inbox.data?.ok && (inbox.data?.data ?? []).length === 0 && (
                <EmptyState icon={<Inbox className="h-10 w-10" />} label="Your inbox is empty" />
              )}
            </>
          ) : (
            <>
              {(sent.data ?? []).map((l) => (
                <div key={l.id} className="flex items-center gap-3 border-b px-4 py-3 text-sm hover:bg-muted/40">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600 uppercase">
                    {l.to_email.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.to_email}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.subject}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase",
                      l.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600",
                    )}>{l.status}</span>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {(sent.data ?? []).length === 0 && (
                <EmptyState icon={<Send className="h-10 w-10" />} label="No sent emails yet" />
              )}
            </>
          )}
        </div>

        {/* ── Message Detail Pane ── */}
        {openMsg && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* toolbar */}
            <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Back" onClick={() => setOpenMsg(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Reply" onClick={() => handleReply(openMsg)}>
                <Reply className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Delete"
                disabled={deleteMsg.isPending}
                onClick={() => handleDelete(openMsg.id)}
              >
                {deleteMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>

            {/* content */}
            <div className="flex-1 overflow-y-auto p-6">
              {msgQuery.isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (() => {
                const full = msgQuery.data?.data ?? openMsg;
                return (
                  <>
                    <h2 className="mb-4 text-lg font-semibold">{full.subject}</h2>
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary uppercase">
                        {initials(full.from)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{full.from}</p>
                        <p className="text-xs text-muted-foreground">To: {full.to}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(full.date)}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                      {full.body_html ? (
                        <iframe
                          srcDoc={full.body_html}
                          className="w-full min-h-64 border-0"
                          sandbox="allow-same-origin"
                          title="Email body"
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans">{full.body_plain || "No content."}</pre>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => handleReply(openMsg)}>
                        <Reply className="mr-1.5 h-3.5 w-3.5" /> Reply
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── Compose Window ── */}
      {composeOpen && (
        <ComposeWindow
          defaults={replyDefaults}
          onClose={() => { setComposeOpen(false); setReplyDefaults(null); }}
          onSent={() => qc.invalidateQueries({ queryKey: ["smtp-logs"] })}
        />
      )}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SidebarBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmailRow({ msg, active, deleting, onOpen, onDelete }: {
  msg: InboxItem; active: boolean; deleting: boolean;
  onOpen: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group flex cursor-pointer items-center gap-3 border-b px-4 py-3 transition-colors",
        active ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40 text-[11px] font-bold text-primary uppercase">
        {initials(msg.from)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{msg.from.replace(/<.*>/, "").trim()}</p>
        <p className="truncate text-xs font-medium">{msg.subject}</p>
        <p className="truncate text-[10px] text-muted-foreground">{msg.date}</p>
      </div>
      <button
        className="invisible shrink-0 rounded p-1 text-muted-foreground hover:text-destructive group-hover:visible"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete"
        disabled={deleting}
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
      {icon}
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ─── Compose Window (Gmail-style floating) ───────────────────────────────────
function ComposeWindow({
  defaults, onClose, onSent,
}: {
  defaults: { to: string; subject: string } | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(defaults?.to ?? "");
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [minimized, setMinimized] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sendMail = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("to", to.trim());
      fd.append("subject", subject.trim() || "(No Subject)");
      fd.append("body", body);
      files.forEach((f) => fd.append("attachments", f));
      return api.post("/smtp/send", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (r) => {
      if (r.data.ok) {
        toast.success("Email sent!");
        onSent();
        onClose();
      } else {
        toast.error(`Failed: ${r.data.error || "check SMTP settings"}`);
      }
    },
    onError: () => toast.error("Send failed"),
  });

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) return toast.error("Recipient email is required");
    sendMail.mutate();
  };

  return (
    <div className="fixed bottom-0 right-6 z-50 flex w-[480px] flex-col rounded-t-xl border border-b-0 bg-card shadow-2xl">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between rounded-t-xl bg-[#404040] px-4 py-2.5 text-white"
        onClick={() => setMinimized((v) => !v)}
      >
        <span className="text-sm font-medium">{defaults ? "Reply" : "New Message"}</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            className="rounded px-1.5 py-0.5 text-xs text-white/70 hover:bg-white/20"
            onClick={() => setMinimized((v) => !v)}
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? "▲" : "▼"}
          </button>
          <button
            className="rounded px-1.5 py-0.5 text-xs text-white/70 hover:bg-white/20"
            onClick={onClose}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <form onSubmit={submit} className="flex flex-col">
          {/* To */}
          <div className="flex items-center border-b px-3 py-1.5">
            <span className="mr-2 text-xs text-muted-foreground">To</span>
            <input
              className="flex-1 bg-transparent text-sm outline-none"
              type="email"
              placeholder="Recipients"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </div>
          {/* Subject */}
          <div className="flex items-center border-b px-3 py-1.5">
            <input
              className="flex-1 bg-transparent text-sm outline-none"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          {/* Body */}
          <textarea
            className="min-h-[200px] resize-none bg-transparent px-3 py-2 text-sm outline-none"
            placeholder="Write your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {/* Attachments list */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Footer toolbar */}
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <Button type="submit" size="sm" disabled={sendMail.isPending} className="h-8 px-4">
              {sendMail.isPending
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</>
                : <><Send className="mr-1.5 h-3.5 w-3.5" />Send</>}
            </Button>
            <button
              type="button"
              title="Attach files"
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={addFiles} />
            <button
              type="button"
              title="Discard"
              className="ml-auto rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onClose}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
