import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAnalyticsRollup, generateRecommendations, listRecommendations, updateRecommendationStatus, type AnalyticsRollup } from "@/lib/analytics/insights.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, ShoppingBag, Mail, Megaphone, FileVideo, Users, Sparkles, Loader2, Check, X, RefreshCw, ExternalLink, Coins } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/analytics/$businessId")({
  component: AnalyticsDetail,
});

type Reco = {
  id: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  problem: string | null;
  recommendation: string | null;
  confidence_score: number | null;
  status: "open" | "done" | "dismissed";
  action_json: { label?: string; route?: string } | null;
  created_at: string;
};

function fmtMoney(n: number) { return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }
function fmtNum(n: number) { return n.toLocaleString(); }

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: any }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function AnalyticsDetail() {
  const { businessId } = Route.useParams();
  const router = useRouter();
  const [rollup, setRollup] = useState<AnalyticsRollup | null>(null);
  const [recos, setRecos] = useState<Reco[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [days, setDays] = useState(30);

  const fetchRollup = useServerFn(getAnalyticsRollup);
  const fetchRecos = useServerFn(listRecommendations);
  const generate = useServerFn(generateRecommendations);
  const updateReco = useServerFn(updateRecommendationStatus);

  const load = async () => {
    setLoading(true);
    try {
      const [r, recs] = await Promise.all([
        fetchRollup({ data: { business_id: businessId, days } }),
        fetchRecos({ data: { business_id: businessId } }),
      ]);
      setRollup(r as AnalyticsRollup);
      setRecos(recs as Reco[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [businessId, days]);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generate({ data: { business_id: businessId } });
      toast.success(`Generated ${res.count} recommendations`);
      const recs = await fetchRecos({ data: { business_id: businessId } });
      setRecos(recs as Reco[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const setRecoStatus = async (id: string, status: "done" | "dismissed") => {
    try {
      await updateReco({ data: { business_id: businessId, id, status } });
      setRecos((cur) => (cur ?? []).map((r) => r.id === id ? { ...r, status } : r));
      toast.success(status === "done" ? "Marked as done" : "Dismissed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const openRecos = useMemo(() => (recos ?? []).filter((r) => r.status === "open"), [recos]);
  const archivedRecos = useMemo(() => (recos ?? []).filter((r) => r.status !== "open"), [recos]);

  if (loading && !rollup) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-60" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!rollup) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/dashboard/analytics" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3 w-3" /> All analytics</Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">{rollup.business.name}</h1>
          <p className="text-sm text-muted-foreground">Last {days} days</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border bg-background px-3 py-2 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Storefront */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Storefront</h2>
          <Link to="/dashboard/storefront/$businessId" params={{ businessId }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Status" value={rollup.storefront.status} icon={BarChart3} />
          <Stat label="Views" value={fmtNum(rollup.storefront.views)} icon={BarChart3} />
          <Stat label="Orders" value={fmtNum(rollup.storefront.orders)} hint={`${fmtMoney(rollup.storefront.revenue)} revenue`} icon={ShoppingBag} />
          <Stat label="Conversion" value={`${rollup.storefront.conversion_rate}%`} icon={BarChart3} />
        </div>
      </section>

      {/* Email */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" /> Email</h2>
          <Link to="/dashboard/emails/$businessId" params={{ businessId }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Campaigns" value={fmtNum(rollup.email.campaigns)} icon={Mail} />
          <Stat label="Sent" value={fmtNum(rollup.email.sent)} hint={`${fmtNum(rollup.email.delivered)} delivered`} icon={Mail} />
          <Stat label="Open rate" value={`${rollup.email.open_rate}%`} hint={`${fmtNum(rollup.email.opens)} opens`} icon={BarChart3} />
          <Stat label="Click rate" value={`${rollup.email.click_rate}%`} hint={`${fmtNum(rollup.email.unsubs)} unsubs`} icon={BarChart3} />
        </div>
      </section>

      {/* Meta */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"><Megaphone className="h-4 w-4" /> Meta posts &amp; ads</h2>
          <div className="flex items-center gap-3">
            <Link to="/dashboard/posts/$businessId" params={{ businessId }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Posts <ExternalLink className="h-3 w-3" /></Link>
            <Link to="/dashboard/ads" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Ads <ExternalLink className="h-3 w-3" /></Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Posts published" value={fmtNum(rollup.meta.posts_published)} hint={`${rollup.meta.posts_drafts} drafts`} icon={Megaphone} />
          <Stat label="Active campaigns" value={fmtNum(rollup.meta.campaigns_active)} icon={Megaphone} />
          <Stat label="Ad spend" value={fmtMoney(rollup.meta.ad_spend)} hint={`${fmtNum(rollup.meta.impressions)} impressions`} icon={BarChart3} />
          <Stat label="CTR" value={`${rollup.meta.ctr}%`} hint={`${fmtNum(rollup.meta.clicks)} clicks`} icon={BarChart3} />
        </div>
      </section>

      {/* UGC + contacts + credits */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-muted-foreground inline-flex items-center gap-2"><FileVideo className="h-4 w-4" /> UGC</span></div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><div className="text-xl font-semibold">{rollup.ugc.scripts}</div><div className="text-xs text-muted-foreground">Scripts</div></div>
            <div><div className="text-xl font-semibold">{rollup.ugc.videos_ready}</div><div className="text-xs text-muted-foreground">Videos ready</div></div>
            <div><div className="text-xl font-semibold">{rollup.ugc.videos_rendering}</div><div className="text-xs text-muted-foreground">Rendering</div></div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-muted-foreground inline-flex items-center gap-2"><Users className="h-4 w-4" /> Contacts</span></div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><div className="text-xl font-semibold">{rollup.contacts.total}</div><div className="text-xs text-muted-foreground">Active</div></div>
            <div><div className="text-xl font-semibold">+{rollup.contacts.new_this_period}</div><div className="text-xs text-muted-foreground">New</div></div>
            <div><div className="text-xl font-semibold">{rollup.contacts.unsubscribed}</div><div className="text-xs text-muted-foreground">Unsubs</div></div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-muted-foreground inline-flex items-center gap-2"><Coins className="h-4 w-4" /> Credits spent</span></div>
          <div className="text-2xl font-semibold">{fmtNum(rollup.credits.spent_this_period)}</div>
          <div className="space-y-1">
            {rollup.credits.top_actions.length === 0 ? (
              <div className="text-xs text-muted-foreground">No spending in this period.</div>
            ) : rollup.credits.top_actions.map((a) => (
              <div key={a.reason} className="flex items-center justify-between text-xs">
                <span className="capitalize text-muted-foreground">{a.reason.replace(/_/g, " ")}</span>
                <span className="font-medium">{a.total}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Recommendations */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI growth recommendations</h2>
          <Button onClick={onGenerate} disabled={generating} className="bg-brand-gradient text-primary-foreground shadow-glow">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {openRecos.length > 0 ? "Regenerate" : "Generate"} (1 credit)
          </Button>
        </div>

        {recos === null ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : openRecos.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <div className="mx-auto h-10 w-10 rounded-2xl bg-brand-gradient grid place-items-center mb-3"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
            <div className="font-medium">No open recommendations</div>
            <div className="text-sm text-muted-foreground mt-1">Generate a fresh batch based on your latest KPIs.</div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {openRecos.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-medium leading-tight">{r.title}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="capitalize">{r.category.replace(/_/g, " ")}</Badge>
                      <Badge variant={r.priority === "high" ? "destructive" : r.priority === "medium" ? "default" : "secondary"} className="capitalize">{r.priority}</Badge>
                      {typeof r.confidence_score === "number" && <Badge variant="outline">{Math.round(r.confidence_score * 100)}% confidence</Badge>}
                    </div>
                  </div>
                </div>
                {r.problem && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Problem:</span> {r.problem}</p>}
                {r.recommendation && <p className="text-sm"><span className="font-medium">Do this:</span> {r.recommendation}</p>}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {r.action_json?.route ? (
                    <Button size="sm" variant="outline" onClick={() => router.navigate({ to: r.action_json!.route! as any })}>
                      {r.action_json?.label || "Open"}
                    </Button>
                  ) : <span />}
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setRecoStatus(r.id, "done")}><Check className="h-4 w-4" /> Done</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRecoStatus(r.id, "dismissed")}><X className="h-4 w-4" /> Dismiss</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {archivedRecos.length > 0 && (
          <details className="rounded-2xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">Archived ({archivedRecos.length})</summary>
            <div className="mt-3 space-y-2">
              {archivedRecos.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="line-clamp-1">{r.title}</span>
                  <Badge variant="outline" className="capitalize">{r.status}</Badge>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
