import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Package, FileText, CreditCard, FolderKanban,
  FileSignature, Settings, LogOut, Bell, ChevronDown, Building2, Mail,
  UserCog, ScrollText, BarChart3, Menu,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { auth, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Role = "admin" | "manager" | "accountant" | "employee" | string;

const navGroups: {
  title: string;
  items: { to: string; icon: typeof LayoutDashboard; label: string; roles?: Role[] }[];
}[] = [
  {
    title: "Overview",
    items: [{ to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    title: "Sales",
    items: [
      { to: "/invoices", icon: FileText, label: "Invoices" },
      { to: "/quotations", icon: FileSignature, label: "Quotations" },
      { to: "/payments", icon: CreditCard, label: "Payments" },
    ],
  },
  {
    title: "Manage",
    items: [
      { to: "/clients", icon: Users, label: "Clients" },
      { to: "/services", icon: Package, label: "Services", roles: ["admin", "manager"] },
      { to: "/projects", icon: FolderKanban, label: "Projects" },
    ],
  },
  {
    title: "Insights",
    items: [
      { to: "/reports", icon: BarChart3, label: "Reports", roles: ["admin", "manager", "accountant"] },
      { to: "/emails", icon: Mail, label: "Emails", roles: ["admin", "manager", "accountant"] },
      { to: "/activity", icon: ScrollText, label: "Activity", roles: ["admin", "manager"] },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/settings/company", icon: Building2, label: "Company", roles: ["admin"] },
      { to: "/settings/smtp", icon: Mail, label: "SMTP", roles: ["admin"] },
      { to: "/settings/users", icon: UserCog, label: "Users", roles: ["admin"] },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const user = auth.getUser() as { name?: string; email?: string; role?: string } | null;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Fetch company settings to get the dynamically cropped circular logo
  const companyQ = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await api.get("/company")).data,
  });

  const handleLogout = () => {
    auth.clear();
    navigate({ to: "/auth/login" });
  };

  const logoSrc = companyQ.data?.logo
    ? `${(api.defaults.baseURL || "").replace(/\/api$/, "")}${companyQ.data.logo}`
    : "/crafzio-logo.svg";

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      {/* sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-32 items-center gap-3 border-b border-sidebar-border px-6">
          <img
            src={logoSrc}
            alt="Crafzio Logo"
            className="h-24 w-24 object-cover rounded-full border-2 border-primary/20 shadow-md"
          />
          <div>
            <p className="text-3xl font-bold tracking-tight text-sidebar-foreground">Crafzio</p>
            <p className="text-[10px] font-medium text-sidebar-foreground/60">IT Services Billing</p>
          </div>
        </div>
        <nav className="scrollbar-thin h-[calc(100vh-8rem)] overflow-y-auto px-3 py-4">
          {navGroups.map((g) => {
            const items = g.items.filter((it) => !it.roles || (user?.role && it.roles.includes(user.role)));
            if (items.length === 0) return null;
            return (
              <div key={g.title} className="mb-5">
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {g.title}
                </p>
                <div className="space-y-0.5">
                  {items.map((it) => {
                    const active = pathname === it.to || pathname.startsWith(it.to + "/");
                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <it.icon className="h-4 w-4" />
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">Welcome back</p>
              <p className="text-sm font-semibold">{user?.name ?? "User"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    {(user?.name?.[0] ?? "U").toUpperCase()}
                  </div>
                  <span className="hidden text-sm md:inline">{user?.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <p className="mt-1 text-[10px] uppercase text-primary">{user?.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/settings/company" })}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
