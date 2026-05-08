import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronDown, Eye, Image as ImageIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/ads/$id")({
  component: CampaignDetail,
});

function CampaignDetail() {
  const { id } = useParams({ from: "/_authenticated/dashboard/ads/$id" });
  const [c, setC] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [productName, setProductName] = useState<string>("");
  const [range, setRange] = useState<"7" | "30" | "all">("30");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [openAds, setOpenAds] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ad_campaigns").select("*").eq("id", id).maybeSingle();
      setC(data);
      if (data?.product_id) {
        const { data: p } = await supabase.from("products").select("title").eq("id", data.product_id).maybeSingle();
        setProductName(p?.title ?? "");
      }
      const { data: a } = await supabase.from("ad_analytics").select("*").eq("campaign_id", id).order("date");
      setAnalytics(a ?? []);
    })();
  }, [id]);

  const filtered = useMemo(() => {
    if (range === "all") return analytics;
    const cutoff = Date.now() - Number(range) * 86400000;
    return analytics.filter((a) => new Date(a.date).getTime() >= cutoff);
  }, [analytics, range]);

  const totals = filtered.reduce(
    (acc, a) => ({
      views: acc.views + (a.ad_views ?? 0),
      visits: acc.visits + (a.page_visits ?? 0),
      leads: acc.leads + (a.leads ?? 0),
      spend: acc.spend + Number(a.spend ?? 0),
    }),
    { views: 0, visits: 0, leads: 0, spend: 0 }
  );
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;

  if (!c) return <div className="p-6 max-w-5xl mx-auto space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  const variants: any[] = c.ad_variants ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link to="/dashboard/ads" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <Badge>{c.status}</Badge>
        </div>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-4 w-4 mr-1" /> Preview Ads
        </Button>
      </div>

      <Card className="p-4 grid sm:grid-cols-4 gap-4 text-sm">
        <Stat label="Ad spend" value={`$${Number(c.spent_amount).toFixed(2)} / $${(Number(c.budget_daily) * Math.max(1, Math.ceil((new Date(c.end_date ?? Date.now()).getTime() - new Date(c.start_date ?? Date.now()).getTime()) / 86400000))).toFixed(2)}`} />
        <Stat label="Schedule" value={`${c.start_date ?? "—"} → ${c.end_date ?? "—"}`} />
        <Stat label="Location" value={(c.locations ?? []).join(", ") || "—"} />
        <Stat label="Running on" value={productName || "Brand awareness"} />
      </Card>

      <Collapsible open={openAds} onOpenChange={setOpenAds}>
        <Card className="p-4">
          <CollapsibleTrigger className="w-full flex items-center justify-between">
            <h3 className="font-semibold">Your Ads ({variants.length})</h3>
            <ChevronDown className={`h-4 w-4 transition-transform ${openAds ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {variants.map((v, i) => (
                <div key={i} className="space-y-1">
                  {v.image_url ? (
                    <img src={v.image_url} alt="" className="w-full h-32 object-cover rounded" />
                  ) : (
                    <div className="w-full h-32 bg-muted rounded grid place-items-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>
                  )}
                  <div className="text-xs font-medium truncate">{v.headline || `Ad #${i + 1}`}</div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Performance</h3>
          <Tabs value={range} onValueChange={(v) => setRange(v as any)}>
            <TabsList>
              <TabsTrigger value="7">7 days</TabsTrigger>
              <TabsTrigger value="30">30 days</TabsTrigger>
              <TabsTrigger value="all">All time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Ad views" value={totals.views.toLocaleString()} />
          <Kpi label="Page visits" value={totals.visits.toLocaleString()} />
          <Kpi label="Leads" value={totals.leads.toLocaleString()} />
          <Kpi label="Cost / lead" value={`$${cpl.toFixed(2)}`} />
        </div>

        <div className="h-64">
          {filtered.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filtered}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="ad_views" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Ad Previews</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
            {variants.map((v, i) => (
              <div key={i} className="border rounded-lg overflow-hidden bg-card">
                <div className="px-3 py-2 border-b flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-bold">B</div>
                  <div>
                    <div className="text-xs font-semibold">Your Brand</div>
                    <div className="text-[10px] text-muted-foreground">Sponsored · 🌐</div>
                  </div>
                </div>
                <div className="px-3 py-2 text-sm">{v.caption}</div>
                {v.image_url ? <img src={v.image_url} alt="" className="w-full" /> : <div className="aspect-square bg-muted" />}
                <div className="px-3 py-2 border-t bg-muted/30">
                  <div className="text-xs text-muted-foreground">YOURBRAND.COM</div>
                  <div className="font-semibold text-sm">{v.headline}</div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium mt-0.5">{value}</div></div>;
}
function Kpi({ label, value }: { label: string; value: string }) {
  return <Card className="p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></Card>;
}
