import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Workflow, Plus, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/automations")({
  component: AutomationsList,
});

function AutomationsList() {
  const [biz, setBiz] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    supabase.from("businesses").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => setBiz(data ?? []));
  }, []);
  if (biz === null) return <div className="p-6"><Skeleton className="h-10 w-60 mb-4" /><Skeleton className="h-32 w-full rounded-2xl" /></div>;
  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
        <Info className="h-4 w-4" /> Demo mode — automations are saved but not scheduled yet. Connect a scheduler in Integrations to activate triggers.
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Email Automations</h1>
        <p className="text-sm text-muted-foreground mt-1">Trigger → delay → action flows with conditions.</p>
      </div>
      {biz.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <h3 className="font-medium">Create a business first</h3>
          <Link to="/dashboard/new" search={{ idea: "" }} className="inline-flex items-center gap-2 mt-4 rounded-lg bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow">
            <Plus className="h-4 w-4" /> New business
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {biz.map((b) => (
            <Link key={b.id} to="/dashboard/automations/$businessId" params={{ businessId: b.id }}
              className="rounded-2xl border bg-card p-4 hover:bg-secondary/40 flex items-center justify-between">
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-muted-foreground">Open builder</div>
              </div>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
