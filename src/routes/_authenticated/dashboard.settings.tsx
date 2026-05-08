import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, User, Building2, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: profile }, { data: m }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
          supabase.from("workspace_members").select("workspace_id, role, workspaces(name)").limit(1).single(),
        ]);
        setFullName(profile?.full_name ?? "");
        if (m) {
          setWorkspaceId(m.workspace_id);
          setRole(m.role);
          setWorkspaceName((m.workspaces as { name: string } | null)?.name ?? "");
        }
      } finally { setLoading(false); }
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally { setSaving(false); }
  };

  const saveWorkspace = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("workspaces").update({ name: workspaceName }).eq("id", workspaceId);
      if (error) throw error;
      toast.success("Workspace renamed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save workspace");
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile, workspace, and account.</p>
      </header>

      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium"><User className="h-4 w-4" /> Profile</div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled className="mt-1" />
          </div>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" placeholder="Your name" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveProfile} disabled={saving} className="bg-brand-gradient text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4" /> Workspace</div>
        <div>
          <Label htmlFor="ws">Workspace name</Label>
          <Input id="ws" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="mt-1" disabled={role !== "owner" && role !== "admin"} />
          <p className="mt-1 text-xs text-muted-foreground">Your role: <span className="capitalize">{role || "member"}</span></p>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveWorkspace} disabled={saving || (role !== "owner" && role !== "admin")} variant="outline">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save workspace"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Shield className="h-4 w-4" /> Security</div>
        <p className="text-sm text-muted-foreground">
          To change your password, sign out and use the &quot;Forgot password&quot; flow on the login page.
        </p>
      </section>
    </div>
  );
}
