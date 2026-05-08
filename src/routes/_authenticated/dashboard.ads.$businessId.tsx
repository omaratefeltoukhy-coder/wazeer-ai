import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, ArrowLeft, Loader2, Pause, Play, Sparkles, Copy, DollarSign } from "lucide-react";
import {
  generateMetaAdCopy, createMetaCampaign, listMetaCampaigns,
  pauseMetaCampaign, updateMetaBudget, regenerateAdCreative, fetchMetaInsights, duplicateMetaAd,
  AD_GOALS, AUDIENCE_KINDS,
} from "@/lib/meta/ads.functions";

export const Route = createFileRoute("/_authenticated/dashboard/ads/$businessId")({
  component: AdsBusinessPage,
});

type WizardData = {
  goal: string; offer_id: string | null; media_asset_id: string | null;
  audience_kind: string; daily_budget: number; duration_days: number;
  copy: any | null; campaign_name: string;
};

const STEPS = ["Goal", "Offer", "Creative", "Audience", "Budget", "Review"] as const;

function AdsBusinessPage() {
  const { businessId } = Route.useParams();
  const list = useServerFn(listMetaCampaigns);
  const genCopy = useServerFn(generateMetaAdCopy);
  const create = useServerFn(createMetaCampaign);
  const pauseFn = useServerFn(pauseMetaCampaign);
  const budget = useServerFn(updateMetaBudget);
  const regen = useServerFn(regenerateAdCreative);
  const insightsFn = useServerFn(fetchMetaInsights);
  const dup = useServerFn(duplicateMetaAd);
  const qc = useQueryClient();

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [w, setW] = useState<WizardData>({
    goal: "sales", offer_id: null, media_asset_id: null,
    audience_kind: "ai_recommended", daily_budget: 20, duration_days: 7,
    copy: null, campaign_name: "",
  });
  const [confirmLaunch, setConfirmLaunch] = useState(false);
  const [budgetFor, setBudgetFor] = useState<{ id: string; current: number } | null>(null);
  const [newBudget, setNewBudget] = useState<number>(0);

  const [offers, setOffers] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[] | null>(null);

  useEffect(() => {
    supabase.from("offers").select("id, name, price, currency").eq("business_id", businessId).then(({ data }) => setOffers(data ?? []));
    supabase.from("media_assets").select("id, type, file_url, prompt").eq("business_id", businessId).eq("status", "ready").then(({ data }) => setMedia(data ?? []));
  }, [businessId]);

  const camps = useQuery({
    queryKey: ["meta_camps", businessId],
    queryFn: () => list({ data: { business_id: businessId } }),
  });

  const adsByCamp = useMemo(() => {
    const m = new Map<string, any[]>();
    (camps.data?.ads ?? []).forEach((a: any) => {
      if (!a.campaign_id) return;
      if (!m.has(a.campaign_id)) m.set(a.campaign_id, []);
      m.get(a.campaign_id)!.push(a);
    });
    return m;
  }, [camps.data]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const generateCopyMut = useMutation({
    mutationFn: () => genCopy({ data: {
      business_id: businessId, goal: w.goal as any, offer_id: w.offer_id, audience_kind: w.audience_kind as any,
      daily_budget: w.daily_budget, duration_days: w.duration_days, media_asset_id: w.media_asset_id,
    } }),
    onSuccess: (r) => {
      setW(prev => ({ ...prev, copy: r.copy, campaign_name: r.copy.campaign_name }));
      toast.success("Ad copy generated");
      next();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const launch = useMutation({
    mutationFn: () => {
      const start = new Date();
      const end = new Date(); end.setDate(end.getDate() + w.duration_days);
      return create({ data: {
        business_id: businessId,
        name: w.campaign_name || w.copy?.campaign_name || "Untitled campaign",
        goal: w.goal as any,
        daily_budget: w.daily_budget,
        total_budget: w.daily_budget * w.duration_days,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        audience: { kind: w.audience_kind as any, notes: "" },
        copy: w.copy ?? {},
        media_asset_id: w.media_asset_id,
      } });
    },
    onSuccess: () => {
      toast.success("Campaign created (demo)");
      setShowWizard(false); setConfirmLaunch(false); setStep(0);
      qc.invalidateQueries({ queryKey: ["meta_camps", businessId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> Demo mode — no real Meta ad spend.
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meta Ads</h1>
          <p className="text-sm text-muted-foreground">Approval required for budget changes and launches.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => insightsFn({ data: { business_id: businessId } }).then((r) => setInsights(r.insights))}>
            Refresh insights
          </Button>
          <Button onClick={() => { setShowWizard(true); setStep(0); }}><Sparkles className="h-4 w-4 mr-2" /> New campaign</Button>
        </div>
      </div>

      {camps.isLoading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (camps.data?.campaigns ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No campaigns yet. Launch your first above.</Card>
      ) : (
        <div className="grid gap-3">
          {(camps.data?.campaigns ?? []).map((c: any) => (
            <Card key={c.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.objective ?? c.goal} · ${Number(c.daily_budget ?? c.budget ?? 0).toFixed(2)}/day · {c.start_date} → {c.end_date}
                  </div>
                </div>
                <Badge variant={c.status === "active" ? "default" : c.status === "paused" ? "secondary" : "outline"}>{c.status}</Badge>
              </div>
              {insights && (() => { const i = insights.find((x: any) => x.campaign_id === c.id); return i ? (
                <div className="text-xs grid grid-cols-5 gap-2 text-muted-foreground">
                  <div>Impressions <div className="text-foreground">{i.impressions}</div></div>
                  <div>Clicks <div className="text-foreground">{i.clicks}</div></div>
                  <div>CTR <div className="text-foreground">{i.ctr}%</div></div>
                  <div>CPC <div className="text-foreground">${i.cpc}</div></div>
                  <div>Spend <div className="text-foreground">${i.spend}</div></div>
                </div>
              ) : null; })()}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => pauseFn({ data: { campaign_id: c.id, pause: c.status !== "paused" } }).then(() => qc.invalidateQueries({ queryKey: ["meta_camps", businessId] }))}>
                  {c.status === "paused" ? <><Play className="h-4 w-4 mr-1" /> Resume</> : <><Pause className="h-4 w-4 mr-1" /> Pause</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setBudgetFor({ id: c.id, current: Number(c.daily_budget ?? c.budget ?? 0) }); setNewBudget(Number(c.daily_budget ?? c.budget ?? 0)); }}>
                  <DollarSign className="h-4 w-4 mr-1" /> Budget
                </Button>
              </div>

              {(adsByCamp.get(c.id) ?? []).map((a: any) => (
                <Card key={a.id} className="p-3 bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{a.status}</Badge>
                    <Badge variant={a.approval_status === "approved" ? "default" : "secondary"}>{a.approval_status}</Badge>
                  </div>
                  <div className="font-medium text-sm">{a.headline}</div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{a.primary_text}</p>
                  <div className="text-xs"><span className="text-muted-foreground">CTA:</span> {a.cta}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => regen({ data: { ad_id: a.id } }).then(() => { toast.success("Creative regenerated"); qc.invalidateQueries({ queryKey: ["meta_camps", businessId] }); }).catch((e) => toast.error(e.message))}>
                      <Sparkles className="h-3 w-3 mr-1" /> Regenerate (1cr)
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dup({ data: { ad_id: a.id } }).then(() => qc.invalidateQueries({ queryKey: ["meta_camps", businessId] }))}>
                      <Copy className="h-3 w-3 mr-1" /> Duplicate
                    </Button>
                  </div>
                </Card>
              ))}
            </Card>
          ))}
        </div>
      )}

      <div className="text-xs"><Link to="/dashboard/integrations/meta" className="underline text-muted-foreground">Manage Meta connections →</Link></div>

      {/* Wizard dialog */}
      <Dialog open={showWizard} onOpenChange={(o) => { if (!o) { setShowWizard(false); setStep(0); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Meta campaign — {STEPS[step]}</DialogTitle>
            <DialogDescription>Step {step + 1} of {STEPS.length}</DialogDescription>
          </DialogHeader>

          {step === 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Goal</label>
              <Select value={w.goal} onValueChange={(v) => setW(p => ({ ...p, goal: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AD_GOALS.map(g => <SelectItem key={g} value={g}>{g.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Offer</label>
              {offers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No offers yet. Skip for now.</p>
              ) : (
                <Select value={w.offer_id ?? ""} onValueChange={(v) => setW(p => ({ ...p, offer_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick offer" /></SelectTrigger>
                  <SelectContent>{offers.map(o => <SelectItem key={o.id} value={o.id}>{o.name} · {o.price} {o.currency}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Creative (optional)</label>
              {media.length === 0 ? (
                <p className="text-sm text-muted-foreground">No media in library yet — generate from AI Images / Videos.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto">
                  {media.map((m) => (
                    <button key={m.id} onClick={() => setW(p => ({ ...p, media_asset_id: m.id }))}
                      className={`relative rounded-md border overflow-hidden aspect-square ${w.media_asset_id === m.id ? "ring-2 ring-primary" : ""}`}>
                      {m.type === "video" ? (
                        <video src={m.file_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={m.file_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Audience</label>
              <Select value={w.audience_kind} onValueChange={(v) => setW(p => ({ ...p, audience_kind: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUDIENCE_KINDS.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Estimated reach: — demo</p>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Daily budget (USD)</label>
              <Input type="number" min={1} max={10000} value={w.daily_budget} onChange={(e) => setW(p => ({ ...p, daily_budget: Number(e.target.value) }))} />
              <label className="text-sm font-medium">Duration (days)</label>
              <Input type="number" min={1} max={365} value={w.duration_days} onChange={(e) => setW(p => ({ ...p, duration_days: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Estimated total: ${(w.daily_budget * w.duration_days).toFixed(2)}</p>
            </div>
          )}
          {step === 5 && (
            <div className="space-y-3 max-h-96 overflow-auto">
              {!w.copy ? (
                <Button onClick={() => generateCopyMut.mutate()} disabled={generateCopyMut.isPending} className="w-full">
                  {generateCopyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="ml-2">Generate ad copy (5 credits)</span>
                </Button>
              ) : (
                <>
                  <Input value={w.campaign_name} onChange={(e) => setW(p => ({ ...p, campaign_name: e.target.value }))} placeholder="Campaign name" />
                  <Card className="p-3 space-y-1 text-sm">
                    <div><span className="text-muted-foreground text-xs">Headline</span><div>{w.copy.headline}</div></div>
                    <div><span className="text-muted-foreground text-xs">Primary text</span><div className="whitespace-pre-wrap">{w.copy.primary_text}</div></div>
                    <div><span className="text-muted-foreground text-xs">Description</span><div>{w.copy.description}</div></div>
                    <div><span className="text-muted-foreground text-xs">CTA</span><div>{w.copy.cta}</div></div>
                    <div><span className="text-muted-foreground text-xs">Audience</span><div>{w.copy.audience_recommendation}</div></div>
                    <div><span className="text-muted-foreground text-xs">Risks</span><div className="text-xs">{w.copy.risks}</div></div>
                  </Card>
                  <Button onClick={() => setConfirmLaunch(true)} className="w-full">Launch campaign</Button>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={prev} disabled={step === 0}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            {step < STEPS.length - 1 && <Button onClick={next}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmLaunch} onOpenChange={setConfirmLaunch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm launch</DialogTitle>
            <DialogDescription>
              Estimated daily spend: <strong>${w.daily_budget.toFixed(2)}</strong> for {w.duration_days} days
              (~${(w.daily_budget * w.duration_days).toFixed(2)} total).
              <br />Meta approval may be required. Results not guaranteed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmLaunch(false)}>Cancel</Button>
            <Button onClick={() => launch.mutate()} disabled={launch.isPending}>
              {launch.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Launch (demo)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!budgetFor} onOpenChange={(o) => !o && setBudgetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update budget</DialogTitle>
            <DialogDescription>Confirm a new daily budget. This will be reflected on Meta after approval.</DialogDescription>
          </DialogHeader>
          <Input type="number" min={1} max={10000} value={newBudget} onChange={(e) => setNewBudget(Number(e.target.value))} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBudgetFor(null)}>Cancel</Button>
            <Button onClick={() => budget({ data: { campaign_id: budgetFor!.id, daily_budget: newBudget, confirmed: true } })
              .then(() => { toast.success("Budget updated"); setBudgetFor(null); qc.invalidateQueries({ queryKey: ["meta_camps", businessId] }); })
              .catch((e: any) => toast.error(e.message))}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
