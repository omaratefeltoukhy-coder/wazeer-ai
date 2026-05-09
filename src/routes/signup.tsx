import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell, Divider } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: (s: Record<string, unknown>) => {
    const r = typeof s.redirect === "string" ? s.redirect : "/dashboard";
    const safe = r.startsWith("/") && !r.startsWith("/login") && !r.startsWith("/signup") ? r : "/dashboard";
    return { redirect: safe, idea: typeof s.idea === "string" ? s.idea : "" };
  },
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: search.redirect });
  },
});

function SignupPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account.");
    navigate({ to: "/login", search: { redirect: search.redirect } });
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      setLoading(false);
      toast.error(String((result.error as Error)?.message ?? result.error));
      return;
    }
    if (!result.redirected) navigate({ to: search.redirect, search: search.idea ? { idea: search.idea } : undefined });
  };

  return (
    <AuthShell title="Start your free 7-day trial" subtitle="No credit card needed.">
      <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
        Continue with Google
      </Button>
      <Divider />
      <form onSubmit={handleEmail} className="space-y-3">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" search={{ redirect: "/dashboard" }} className="text-foreground font-medium hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
