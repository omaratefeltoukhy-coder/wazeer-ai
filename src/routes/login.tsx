import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/wazeer/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>) => {
    const r = typeof s.redirect === "string" ? s.redirect : "/dashboard";
    const safe = r.startsWith("/") && !r.startsWith("/login") && !r.startsWith("/signup") ? r : "/dashboard";
    return { redirect: safe };
  },
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: search.redirect });
  },
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: search.redirect });
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + search.redirect,
    });
    if (result.error) {
      setLoading(false);
      toast.error(String((result.error as Error)?.message ?? result.error));
      return;
    }
    if (!result.redirected) navigate({ to: search.redirect });
  };

  return (
    <AuthShell title="Sign in to Wazeer" subtitle="Continue building your business.">
      <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
        Continue with Google
      </Button>
      <Divider />
      <form onSubmit={handleEmail} className="space-y-3">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" search={{ redirect: "/dashboard", idea: "" }} className="text-foreground font-medium hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo /></div>
        <div className="rounded-2xl border bg-card p-6 shadow-elevated space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Divider() {
  return (
    <div className="relative my-1">
      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
      <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
    </div>
  );
}
