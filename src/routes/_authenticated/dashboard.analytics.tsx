import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  component: AnalyticsList,
});

type Biz = { id: string; name: string };

function AnalyticsList() {
  const [businesses, setBusinesses] = useState<Biz[] | null>(null);

  useEffect(() => {
    supabase.from("businesses").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => setBusinesses((data as Biz[]) ?? []));
  }, []);

  if (businesses === null) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-60" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics & Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">Unified KPIs across storefront, email, Meta and UGC, plus AI growth recommendations.</p>
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-gradient grid place-items-center mb-3">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <h3 className="font-medium">No businesses yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create a business to start tracking performance.</p>
          <Link to="/dashboard/new" search={{ idea: "" }} className="inline-flex items-center gap-2 mt-4 rounded-lg bg-brand-gradient text-primary-foreground px-3 py-2 text-sm font-medium shadow-glow">
            <Plus className="h-4 w-4" /> New business
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link key={b.id} to="/dashboard/analytics/$businessId" params={{ businessId: b.id }}
              className="rounded-2xl border bg-card p-4 hover:bg-secondary/40 transition-colors flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-muted-foreground">View KPIs &amp; recommendations</div>
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
