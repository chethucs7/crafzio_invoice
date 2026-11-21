import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, Mail, Save, Send, TestTube2, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/smtp")({
  component: SmtpSettingsPage,
});

interface Smtp {
  host: string; port: number; username: string; password?: string;
  from_email: string; from_name: string; reply_to?: string;
  use_tls: boolean; use_ssl: boolean; enabled: boolean;
  imap_host?: string; imap_port?: number; imap_username?: string; imap_password?: string;
  imap_use_ssl?: boolean; imap_folder?: string; imap_enabled?: boolean;
  invoice_email_subject?: string; invoice_email_template?: string;
}

const DEFAULT_TEMPLATE = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#fff">
  <h2 style="color:#0f172a">Invoice {inv}</h2>
  <p>Dear {name},</p>
  <p>Please find attached your invoice for the amount <b>{sym}{amt}</b>, due on <b>{due}</b>.</p>
  <p>Thank you for your business.</p>
  <hr/>
  <p style="color:#64748b;font-size:12px">{company}</p>
</div>`;

function SmtpSettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["smtp"],
    queryFn: async () => (await api.get("/smtp")).data as Smtp,
  });
  const { register, handleSubmit, reset, watch, setValue, getValues } = useForm<Smtp>();
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  useEffect(() => {
    if (data) reset({ ...data, password: "", imap_password: "", invoice_email_template: data.invoice_email_template || DEFAULT_TEMPLATE });
  }, [data, reset]);

  const save = useMutation({
    mutationFn: (v: Smtp) => api.put("/smtp", v),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["smtp"] }); },
  });
  const testConn = useMutation({
    mutationFn: () => api.post("/smtp/test-connection"),
    onSuccess: (r) => toast[r.data.ok ? "success" : "error"](r.data.message || (r.data.ok ? "Connected" : "Failed")),
  });
  const testEmail = useMutation({
    mutationFn: (to: string) => api.post("/smtp/test-email", { to }),
    onSuccess: (r) => {
      if (r.data.ok) {
        toast.success("Test email sent");
      } else {
        toast.error(`Send failed: ${r.data.error || "check SMTP settings"}`);
      }
    },
  });
  const doPreview = useMutation({
    mutationFn: () => api.post("/smtp/invoice-preview", {
      subject: getValues("invoice_email_subject"),
      template: getValues("invoice_email_template"),
    }),
    onSuccess: (r) => setPreview(r.data),
  });

  const applyGmail = () => {
    setValue("host", "smtp.gmail.com");
    setValue("port", 587);
    setValue("use_tls", true);
    setValue("use_ssl", false);
    setValue("imap_host", "imap.gmail.com");
    setValue("imap_port", 993);
    setValue("imap_use_ssl", true);
    setValue("imap_enabled", true);
    toast.success("Gmail preset applied — use a Google App Password for the password.");
  };

  return (
    <>
      <PageHeader
        title="Email settings"
        description="SMTP (outgoing), IMAP (inbox) and the invoice email template"
        actions={
          <Button variant="outline" type="button" onClick={applyGmail}>
            <Wand2 className="mr-2 h-4 w-4" />Use Gmail preset
          </Button>
        }
      />
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6">
        <Tabs defaultValue="smtp">
          <TabsList>
            <TabsTrigger value="smtp"><Send className="mr-2 h-4 w-4" />SMTP</TabsTrigger>
            <TabsTrigger value="imap"><Mail className="mr-2 h-4 w-4" />IMAP inbox</TabsTrigger>
            <TabsTrigger value="template"><Eye className="mr-2 h-4 w-4" />Invoice template</TabsTrigger>
          </TabsList>

          <TabsContent value="smtp">
            <div className="rounded-xl border bg-card p-6 shadow-soft space-y-4">
              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                <div>
                  <p className="text-sm font-medium">Enable email sending</p>
                  <p className="text-xs text-muted-foreground">Master switch — turn off to disable all outgoing mail.</p>
                </div>
                <Switch checked={!!watch("enabled")} onCheckedChange={(v) => setValue("enabled", v)} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="SMTP host"><Input {...register("host")} placeholder="smtp.gmail.com" /></Field>
                <Field label="Port"><Input type="number" {...register("port", { valueAsNumber: true })} /></Field>
                <Field label="Username"><Input {...register("username")} placeholder="you@gmail.com" /></Field>
                <Field label="Password / App password">
                  <Input type="password" {...register("password")} placeholder="Leave blank to keep existing" />
                </Field>
                <Field label="From email"><Input type="email" {...register("from_email")} /></Field>
                <Field label="From name"><Input {...register("from_name")} /></Field>
                <Field label="Reply-to"><Input type="email" {...register("reply_to")} /></Field>
                <div className="flex items-center gap-6 pt-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("use_tls")} /> TLS
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("use_ssl")} /> SSL
                  </label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <b>Gmail:</b> enable 2-Step Verification, then create an <b>App password</b> (Google Account → Security → App passwords) and paste it into the Password field.
              </p>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => testConn.mutate()}>
                  <TestTube2 className="mr-2 h-4 w-4" />Test connection
                </Button>
                <Button variant="outline" type="button" onClick={() => {
                  const to = prompt("Send test email to:");
                  if (to) testEmail.mutate(to);
                }}>
                  <Send className="mr-2 h-4 w-4" />Send test email
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="imap">
            <div className="rounded-xl border bg-card p-6 shadow-soft space-y-4">
              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                <div>
                  <p className="text-sm font-medium">Enable inbox (IMAP)</p>
                  <p className="text-xs text-muted-foreground">Fetch received emails to show in the Emails page.</p>
                </div>
                <Switch checked={!!watch("imap_enabled")} onCheckedChange={(v) => setValue("imap_enabled", v)} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="IMAP host"><Input {...register("imap_host")} placeholder="imap.gmail.com" /></Field>
                <Field label="Port"><Input type="number" {...register("imap_port", { valueAsNumber: true })} /></Field>
                <Field label="Username"><Input {...register("imap_username")} placeholder="you@gmail.com" /></Field>
                <Field label="Password / App password">
                  <Input type="password" {...register("imap_password")} placeholder="Leave blank to reuse SMTP password" />
                </Field>
                <Field label="Folder"><Input {...register("imap_folder")} placeholder="INBOX" /></Field>
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <input type="checkbox" {...register("imap_use_ssl")} /> SSL (recommended)
                </label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="template">
            <div className="rounded-xl border bg-card p-6 shadow-soft space-y-4">
              <Field label="Subject line">
                <Input {...register("invoice_email_subject")} placeholder="Invoice {inv} from {company}" />
              </Field>
              <Field label="HTML body">
                <Textarea rows={14} className="font-mono text-xs" {...register("invoice_email_template")} />
              </Field>
              <p className="text-xs text-muted-foreground">
                Available placeholders: <code>{"{inv}"}</code>, <code>{"{name}"}</code>, <code>{"{company}"}</code>, <code>{"{sym}"}</code>, <code>{"{amt}"}</code>, <code>{"{due}"}</code>
              </p>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => doPreview.mutate()}>
                  <Eye className="mr-2 h-4 w-4" />Preview
                </Button>
              </div>
              {preview && (
                <div className="rounded-lg border bg-background">
                  <div className="border-b p-3 text-sm"><b>Subject:</b> {preview.subject}</div>
                  <iframe title="Preview" srcDoc={preview.html} className="h-96 w-full rounded-b-lg" />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button type="submit"><Save className="mr-2 h-4 w-4" />Save all</Button>
        </div>
      </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
