import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/ads")({
  component: AdsHubPage,
});

function AdsHubPage() {
  const [businesses, setBusinesses] = useState<any[] | null>(null);
  useEffect(() => {
    supabase.from("businesses").select("id, name, type").order("created_at", { ascending: false })
      .then(({ data }) => setBusinesses(data ?? []));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> Demo mode — no real Meta ad spend will occur.
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Meta Ads</h1>
        <p className="text-sm text-muted-foreground">Build campaigns with AI-generated copy and creatives.</p>
      </div>
      {!businesses ? (
        <div className="grid sm:grid-cols-2 gap-3">{[0,1].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : businesses.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Create a business first.</Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {businesses.map((b) => (
            <Link key={b.id} to="/dashboard/ads/$businessId" params={{ businessId: b.id }} className="block">
              <Card className="p-4 hover:bg-secondary/40 transition-colors">
                <div className="font-medium flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> {b.name}</div>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{b.type}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
