import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { api, auth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";

type FormData = { email: string; password: string; remember: boolean };

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email: data.email, password: data.password });
      auth.setSession(res.data.access_token, res.data.refresh_token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}`);
      navigate({ to: "/dashboard" });
    } catch {
      /* interceptor already toasted */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lift">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lift">
            I
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Crafzio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your invoice management workspace
          </p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          method="post"
          action="#"
          autoComplete="on"
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required {...register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              {...register("password")}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" {...register("remember")} className="rounded" />
            Remember me on this device
          </label>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            Sign in
          </Button>
        </form>
        <p className="mt-6 rounded-md bg-muted p-3 text-center text-xs text-muted-foreground">
          Default admin: <b>admin@example.com</b> / <b>Admin@123</b>
          <br />
          Backend must be running at{" "}
          <code className="rounded bg-background px-1">http://localhost:5000</code>
        </p>
      </div>
    </div>
  );
}
