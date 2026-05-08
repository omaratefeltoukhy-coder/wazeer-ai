import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Target, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/ads/")({
  component: AdsListPage,
});

type Campaign = {
  id: string;
  name: string;
  status: string;
  budget_daily: number;
  spent_amount: number;
  result_count: number;
  start_date: string | null;
  end_date: string | null;
  meta_campaign_id: string | null;
};

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700",
    paused: "bg-amber-500/15 text-amber-700",
    ended: "bg-muted text-muted-foreground",
    draft: "bg-secondary text-foreground",
  };
  return <Badge className={map[s] ?? "bg-secondary"}>{s}</Badge>;
}

function AdsListPage() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [metaConnected, setMetaConnected] = useState(false);
  const { data: ent } = useEntitlements();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ad_campaigns")
        .select("id,name,status,budget_daily,spent_amount,result_count,start_date,end_date,meta_campaign_id")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setItems((data as any) ?? []);
      const { data: conn } = await supabase.from("meta_connections").select("token_status").limit(1).maybeSingle();
      setMetaConnected(conn?.token_status === "connected");
    })();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Meta Ads</h1>
          <p className="text-sm text-muted-foreground">Launch and manage your ad campaigns.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs px-3 py-1.5 rounded-lg border bg-card inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Credits: {(ent?.credits_balance ?? 0).toFixed(2)}
          </div>
          <Button onClick={() => navigate({ to: "/dashboard/ads/new" })}>
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </div>
      </div>

      {!metaConnected && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Connect your Meta account to activate your campaigns.
          <Link to="/dashboard/integrations/meta" className="ml-auto underline">Connect now</Link>
        </div>
      )}

      {!items ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 grid place-items-center">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground">Launch your first ad to grow your audience.</p>
          <Button onClick={() => navigate({ to: "/dashboard/ads/new" })}>
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Ad spend</th>
                <th className="px-4 py-3">Results</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const total = (c.budget_daily ?? 0) *
                  (c.start_date && c.end_date
                    ? Math.max(1, Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000))
                    : 1);
                return (
                  <tr key={c.id} className="border-t hover:bg-secondary/30 cursor-pointer"
                    onClick={() => navigate({ to: "/dashboard/ads/$id", params: { id: c.id } })}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3"><StatusBadge s={c.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.start_date ?? "—"} → {c.end_date ?? "—"}
                    </td>
                    <td className="px-4 py-3">${Number(c.spent_amount).toFixed(2)} / ${total.toFixed(2)}</td>
                    <td className="px-4 py-3">{c.result_count} leads</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
