import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit, Key, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/lib/types";
import { statusColor } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/users")({
  component: UsersSettingsPage,
});

const ROLE_MATRIX: { role: string; summary: string; can: string[] }[] = [
  { role: "Admin", summary: "Full control of the system.", can: ["Manage users & roles", "Company & SMTP settings", "All invoices, payments, reports"] },
  { role: "Manager", summary: "Runs day-to-day operations.", can: ["Create / edit clients & services", "Send invoices & quotations", "View reports & activity"] },
  { role: "Accountant", summary: "Handles billing & payments.", can: ["Create & send invoices", "Record payments", "View sales & GST reports"] },
  { role: "Employee", summary: "Limited operational access.", can: ["View assigned clients & projects", "Create draft invoices", "No settings access"] },
];

function UsersSettingsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [changePwOpen, setChangePwOpen] = useState(false);

  const users = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data as { data: User[] },
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.get("/users/roles")).data as { data: { id: number; name: string }[] },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success("Deleted user successfully"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error || "Delete failed"),
  });

  // Toggle user status (Activate / Suspend)
  const toggleStatus = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.put(`/users/${id}`, { is_active }),
    onSuccess: (_, variables) => {
      toast.success(variables.is_active ? "User activated" : "User suspended");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  // Get permissions list based on role
  const getPermissions = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case "admin":
        return ["billing", "payments", "clients", "reports", "settings", "users"];
      case "manager":
        return ["billing", "payments", "clients", "reports"];
      case "accountant":
        return ["billing", "payments", "reports"];
      case "employee":
        return ["billing (drafts)", "clients"];
      default:
        return [];
    }
  };

  return (
    <>
      <PageHeader
        title="Users & staff"
        description="Admin creates staff accounts and assigns roles that control what they can see & do."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setChangePwOpen(true)}>
              <Key className="mr-1.5 h-3.5 w-3.5" /> Change My Password
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New User
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        {ROLE_MATRIX.map((r) => (
          <div key={r.role} className="rounded-xl border bg-card p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase text-primary">{r.role}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.summary}</p>
            <ul className="mt-2 space-y-1 text-xs">
              {r.can.map((c) => (
                <li key={c} className="flex gap-1.5"><span className="text-emerald-600 font-bold">✓</span>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>System Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data?.data.map((u) => {
              const uPerms = u.permissions 
                ? u.permissions.split(",").map(x => x.trim()).filter(Boolean) 
                : getPermissions(u.role);
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-sm">{u.name}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase font-medium">{u.role}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {uPerms.map((p) => (
                        <span key={p} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 uppercase border border-blue-100">
                          {p}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase font-semibold", statusColor(u.is_active ? "active" : "inactive"))}>
                        {u.is_active ? "active" : "suspended"}
                      </span>
                      <Button
                        variant="outline"
                        size="xs"
                        className="text-[10px] h-6 px-2"
                        onClick={() => toggleStatus.mutate({ id: u.id, is_active: !u.is_active })}
                      >
                        {u.is_active ? "Suspend" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" title="Reset Password"
                        onClick={() => setResetUser(u)}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" title="Edit User"
                        onClick={() => setEditUser(u)}
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" title="Delete User"
                        onClick={() => { if (confirm(`Are you sure you want to delete ${u.name}?`)) del.mutate(u.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── CREATE USER DIALOG ── */}
      <NewUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles.data?.data ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["users"] })}
      />

      {/* ── EDIT USER DIALOG ── */}
      {editUser && (
        <EditUserDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(o) => !o && setEditUser(null)}
          roles={roles.data?.data ?? []}
          onSaved={() => {
            setEditUser(null);
            qc.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}

      {/* ── RESET PASSWORD DIALOG ── */}
      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          open={!!resetUser}
          onOpenChange={(o) => !o && setResetUser(null)}
        />
      )}

      {/* ── CHANGE OWN PASSWORD DIALOG ── */}
      <ChangePasswordDialog
        open={changePwOpen}
        onOpenChange={setChangePwOpen}
      />
    </>
  );
}

// ─── Dialog: New User ────────────────────────────────────────────────────────
function NewUserDialog({ open, onOpenChange, roles, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  roles: { id: number; name: string }[]; onSaved: () => void;
}) {
  interface Form { name: string; email: string; password: string; role_id: number; phone: string; permissions: string }
  const { register, handleSubmit, setValue, reset, watch } = useForm<Form>({
    defaultValues: { password: "Password@123", permissions: "billing,clients" }
  });

  const selectedPermissions = watch("permissions") ? watch("permissions").split(",") : [];

  const handlePermissionChange = (pKey: string, checked: boolean) => {
    let current = watch("permissions") ? watch("permissions").split(",").map(x => x.trim()).filter(Boolean) : [];
    if (checked) {
      if (!current.includes(pKey)) current.push(pKey);
    } else {
      current = current.filter((x) => x !== pKey);
    }
    setValue("permissions", current.join(","));
  };

  const handleRoleChange = (roleIdStr: string) => {
    const roleId = Number(roleIdStr);
    setValue("role_id", roleId);
    const roleObj = roles.find((r) => r.id === roleId);
    if (roleObj) {
      switch (roleObj.name.toLowerCase()) {
        case "admin":
          setValue("permissions", "billing,payments,clients,reports,settings,users");
          break;
        case "manager":
          setValue("permissions", "billing,payments,clients,reports");
          break;
        case "accountant":
          setValue("permissions", "billing,payments,reports");
          break;
        case "employee":
          setValue("permissions", "billing,clients");
          break;
      }
    }
  };

  const save = useMutation({
    mutationFn: (v: Form) => api.post("/users", { ...v, is_active: true }),
    onSuccess: () => {
      toast.success("User created & credentials emailed!");
      onSaved();
      onOpenChange(false);
      reset();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Creation failed"),
  });

  const PERMS = [
    { key: "billing", label: "Billing & Invoices" },
    { key: "payments", label: "Record & View Payments" },
    { key: "clients", label: "Manage Clients & Projects" },
    { key: "reports", label: "View Financial Reports" },
    { key: "settings", label: "Manage SMTP & Company Settings" },
    { key: "users", label: "Manage System Users" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New user</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input required {...register("name")} /></div>
          <div className="space-y-1.5"><Label>Email *</Label><Input required type="email" {...register("email")} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input {...register("phone")} /></div>
          <div className="space-y-1.5">
            <Label>Temporary Password *</Label>
            <Input required type="text" {...register("password")} />
            <p className="text-[10px] text-muted-foreground">Emailed immediately.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select onValueChange={handleRoleChange}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Permissions Section */}
          <div className="col-span-2 border-t pt-3 mt-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Permissions Access</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PERMS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 rounded-lg border p-2 text-xs hover:bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(p.key)}
                    onChange={(e) => handlePermissionChange(p.key, e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="col-span-2 pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Edit User ───────────────────────────────────────────────────────
function EditUserDialog({ user, open, onOpenChange, roles, onSaved }: {
  user: User; open: boolean; onOpenChange: (o: boolean) => void;
  roles: { id: number; name: string }[]; onSaved: () => void;
}) {
  interface Form { name: string; email: string; phone: string; role_id: number; is_active: boolean; permissions: string }
  const matchedRole = roles.find((r) => r.name.toLowerCase() === user.role.toLowerCase());

  // Determine initial permissions: fall back to role defaults if none stored
  const getRoleDefaultPermissions = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case "admin": return "billing,payments,clients,reports,settings,users";
      case "manager": return "billing,payments,clients,reports";
      case "accountant": return "billing,payments,reports";
      case "employee": return "billing,clients";
      default: return "";
    }
  };

  const { register, handleSubmit, setValue, watch } = useForm<Form>({
    defaultValues: {
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role_id: matchedRole?.id,
      is_active: user.is_active,
      permissions: user.permissions || getRoleDefaultPermissions(user.role),
    }
  });

  const selectedPermissions = watch("permissions") ? watch("permissions").split(",") : [];

  const handlePermissionChange = (pKey: string, checked: boolean) => {
    let current = watch("permissions") ? watch("permissions").split(",").map(x => x.trim()).filter(Boolean) : [];
    if (checked) {
      if (!current.includes(pKey)) current.push(pKey);
    } else {
      current = current.filter((x) => x !== pKey);
    }
    setValue("permissions", current.join(","));
  };

  const save = useMutation({
    mutationFn: (v: Form) => api.put(`/users/${user.id}`, v),
    onSuccess: () => {
      toast.success("User updated successfully");
      onSaved();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Update failed"),
  });

  const PERMS = [
    { key: "billing", label: "Billing & Invoices" },
    { key: "payments", label: "Record & View Payments" },
    { key: "clients", label: "Manage Clients & Projects" },
    { key: "reports", label: "View Financial Reports" },
    { key: "settings", label: "Manage SMTP & Company Settings" },
    { key: "users", label: "Manage System Users" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit User: {user.name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input required {...register("name")} /></div>
          <div className="space-y-1.5"><Label>Email *</Label><Input required type="email" {...register("email")} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input {...register("phone")} /></div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select defaultValue={String(matchedRole?.id || "")} onValueChange={(v) => setValue("role_id", Number(v))}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select defaultValue={user.is_active ? "active" : "inactive"} onValueChange={(v) => setValue("is_active", v === "active")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Permissions Section */}
          <div className="col-span-2 border-t pt-3 mt-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Permissions Access</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PERMS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 rounded-lg border p-2 text-xs hover:bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(p.key)}
                    onChange={(e) => handlePermissionChange(p.key, e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="col-span-2 pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Admin Reset Password ───────────────────────────────────────────
function ResetPasswordDialog({ user, open, onOpenChange }: {
  user: User; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [newPassword, setNewPassword] = useState("ResetPass@123");

  const reset = useMutation({
    mutationFn: () => api.post(`/users/${user.id}/reset-password`, { password: newPassword }),
    onSuccess: () => {
      toast.success(`Password reset & emailed to ${user.email}`);
      onOpenChange(false);
    },
    onError: () => toast.error("Password reset failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Reset Password
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            You are resetting the password for <b>{user.name}</b> ({user.email}). The new password will be emailed to their registered address immediately.
          </p>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => reset.mutate()} disabled={reset.isPending}>
            Confirm Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Change Own Password ────────────────────────────────────────────
function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  interface Form { current: string; newPass: string; confirm: string }
  const { register, handleSubmit, reset } = useForm<Form>();

  const change = useMutation({
    mutationFn: (v: Form) => api.post("/users/change-password", {
      current_password: v.current,
      new_password: v.newPass,
    }),
    onSuccess: () => {
      toast.success("Password changed successfully!");
      onOpenChange(false);
      reset();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Password change failed"),
  });

  const onSubmit = (values: Form) => {
    if (values.newPass !== values.confirm) {
      return toast.error("New passwords do not match");
    }
    change.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <Input required type="password" {...register("current")} />
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input required type="password" {...register("newPass")} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input required type="password" {...register("confirm")} />
          </div>
          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={change.isPending}>Change Password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
