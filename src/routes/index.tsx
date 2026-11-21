import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const t =
      typeof window !== "undefined" ? localStorage.getItem("ims_token") : null;
    throw redirect({ to: t ? "/dashboard" : "/auth/login" });
  },
  component: () => null,
});
