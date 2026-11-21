import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";

export const Route = createFileRoute("/auth")({
  component: () => (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-primary/20 to-background">
      <Toaster richColors position="top-right" />
      <Outlet />
    </div>
  ),
});
