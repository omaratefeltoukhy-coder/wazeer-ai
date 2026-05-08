import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  generateEmailCampaign, regenerateEmailMessage, updateEmailMessage,
  duplicateEmailMessage, archiveEmailMessage, sendTestEmail, sendEmailCampaign,
  scheduleEmail, getCampaign, listCampaigns, getCampaignAnalytics, seedDemoContacts,
  CAMPAIGN_TYPES, CAMPAIGN_LABEL,
} from "@/lib/ai/email.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Mail, Plus, Send, Save, Sparkles, Copy, Archive, Calendar, RefreshCw, ChevronLeft, Users, BarChart3, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

const Search = z.object({
  campaignId: z.string().uuid().optional(),
}).passthrough();

export const Route = createFileRoute("/_authenticated/dashboard/emails/$businessId")({
  validateSearch: Search,
  component: EmailEditor,
});

function EmailEditor() {
  const { businessId } = Route.useParams();
  const search = Route.useSearch() as { campaignId?: string };
  const navigate = useNavigate();

  const [biz, setBiz] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(search.campaignId ?? null);
  const [campaign, setCampaign] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genState, setGenState] = useState({ type: "welcome" as typeof CAMPAIGN_TYPES[number], tone: "warm, helpful", length: 5 as 3 | 5 | 7, audience_note: "" });
  const [genLoading, setGenLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const listFn = useServerFn(listCampaigns);
  const generateFn = useServerFn(generateEmailCampaign);
  const getFn = useServerFn(getCampaign);
  const analyticsFn = useServerFn(getCampaignAnalytics);
  const updateFn = useServerFn(updateEmailMessage);
  const regenFn = useServerFn(regenerateEmailMessage);
  const duplicateFn = useServerFn(duplicateEmailMessage);
  const archiveFn = useServerFn(archiveEmailMessage);
  const testFn = useServerFn(sendTestEmail);
  const scheduleFn = useServerFn(scheduleEmail);
  const sendFn = useServerFn(sendEmailCampaign);
  const seedFn = useServerFn(seedDemoContacts);

  useEffect(() => {
    supabase.from("businesses").select("id, name").eq("id", businessId).maybeSingle()
      .then(({ data }) => setBiz(data));
    refreshList();
  }, [businessId]);

  async function refreshList() {
    const r: any = await listFn({ data: { business_id: businessId } });
    setCampaigns(r.campaigns);
    if (!activeId && r.campaigns?.[0]?.id) setActiveId(r.campaigns[0].id);
  }

  useEffect(() => {
    if (!activeId) { setCampaign(null); setMessages([]); setAnalytics(null); return; }
    setCampaign(null); setAnalytics(null);
    getFn({ data: { campaign_id: activeId } }).then((r: any) => {
      setCampaign(r.campaign); setMessages(r.messages);
    }).catch((e: any) => toast.error(e?.message ?? "Failed"));
    analyticsFn({ data: { campaign_id: activeId } }).then(setAnalytics).catch(() => {});
  }, [activeId]);

  async function handleGenerate() {
    setGenLoading(true);
    try {
      const r: any = await generateFn({ data: { business_id: businessId, ...genState } });
      toast.success(`Generated ${r.count} emails`);
      setGenOpen(false);
      await refreshList();
      setActiveId(r.campaign_id);
      navigate({ to: "/dashboard/emails/$businessId", params: { businessId }, search: { campaignId: r.campaign_id } as any });
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally { setGenLoading(false); }
  }

  async function patchMsg(id: string, patch: any) {
    setMessages((m) => m.map((x) => x.id === id ? { ...x, ...patch } : x));
    try { await updateFn({ data: { message_id: id, patch } }); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  }

  async function regen(id: string) {
    setBusy(id);
    try {
      const r: any = await regenFn({ data: { message_id: id } });
      setMessages((m) => m.map((x) => x.id === id ? { ...x, ...r.email } : x));
      toast.success("Regenerated (1 credit)");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(null); }
  }

  async function dup(id: string) {
    try { await duplicateFn({ data: { message_id: id } }); toast.success("Duplicated"); refreshActive(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function arch(id: string) {
    try { await archiveFn({ data: { message_id: id } }); toast.success("Archived"); refreshActive(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function refreshActive() {
    if (!activeId) return;
    const r: any = await getFn({ data: { campaign_id: activeId } });
    setCampaign(r.campaign); setMessages(r.messages);
  }

  async function test(id: string) {
    const to = await promptDialog({ title: "Send test email", label: "Recipient email", placeholder: "you@example.com" });
    if (!to) return;
    try {
      await testFn({ data: { message_id: id, to_email: to } });
      toast.success("Test email queued via Resend (demo mode)");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function schedule(id: string) {
    const when = await promptDialog({ title: "Schedule send", label: "ISO date", placeholder: "2026-05-10T10:00:00Z" });
    if (!when) return;
    try {
      const iso = new Date(when).toISOString();
      await scheduleFn({ data: { message_id: id, scheduled_at: iso } });
      toast.success("Scheduled");
      refreshActive();
    } catch (e: any) { toast.error(e?.message ?? "Invalid date"); }
  }
  async function approveAndSend() {
    if (!activeId) return;
    if (!(await confirmDialog({ title: "Send campaign?", description: "Sends to all eligible contacts (demo dispatcher).", confirmText: "Send" }))) return;
    setBusy("send");
    try {
      const r: any = await sendFn({ data: { campaign_id: activeId } });
      toast.success(`Sent to ${r.recipients} contacts (demo)`);
      refreshActive();
      analyticsFn({ data: { campaign_id: activeId } }).then(setAnalytics);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(null); }
  }

  async function seedContacts() {
    try { const r: any = await seedFn({ data: { business_id: businessId, count: 25 } }); toast.success(`Seeded ${r.count} demo contacts`); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link to="/dashboard/emails" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
            <ChevronLeft className="h-4 w-4" /> Emails
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{biz?.name ?? "Business"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard/automations/$businessId" params={{ businessId }}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-secondary/50">
            <SettingsIcon className="h-4 w-4" /> Automations
          </Link>
          <Button variant="outline" size="sm" onClick={seedContacts}><Users className="h-4 w-4 mr-1" /> Seed demo contacts</Button>
          <Button onClick={() => setGenOpen(true)} className="bg-brand-gradient text-primary-foreground">
            <Sparkles className="h-4 w-4 mr-1" /> Generate sequence
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-5">
        <aside className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campaigns</div>
          {campaigns === null ? (
            <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-xl border bg-card p-3">No campaigns yet. Generate one.</div>
          ) : campaigns.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`w-full text-left rounded-xl border bg-card p-3 hover:bg-secondary/50 ${activeId === c.id ? "ring-2 ring-primary/50" : ""}`}>
              <div className="text-sm font-medium leading-tight line-clamp-2">{c.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 capitalize">
                <Badge variant="outline" className="text-[10px]">{c.status ?? "draft"}</Badge>
                {c.type && <span>{c.type.replace(/_/g, " ")}</span>}
              </div>
            </button>
          ))}
        </aside>

        <section className="min-w-0 space-y-4">
          {!activeId ? (
            <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">Select or generate a campaign.</div>
          ) : !campaign ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              {[0,1,2].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <Input value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                      onBlur={async () => { await supabase.from("email_campaigns").update({ name: campaign.name }).eq("id", campaign.id); }}
                      className="text-xl font-semibold border-0 shadow-none px-0 h-auto py-1 focus-visible:ring-0" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {campaign.content_json?.goal ?? ""} · Segment: {campaign.content_json?.segment ?? "—"}
                    </p>
                  </div>
                  <Button onClick={approveAndSend} disabled={busy === "send"} className="bg-brand-gradient text-primary-foreground">
                    <Send className="h-4 w-4 mr-1" /> {busy === "send" ? "Sending…" : "Approve & send"}
                  </Button>
                </div>
              </div>

              <AnalyticsCard analytics={analytics} />

              <div className="space-y-3">
                {messages.filter((m) => m.status !== "archived").map((m, idx) => (
                  <article key={m.id} className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline">#{idx + 1}</Badge>
                        <Input value={m.name} onChange={(e) => patchMsg(m.id, { name: e.target.value })}
                          className="font-medium border-0 shadow-none px-0 h-auto py-1 focus-visible:ring-0 min-w-[12rem]" />
                        <Badge variant="secondary" className="text-[10px]">{m.send_delay}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{m.status ?? "draft"}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => test(m.id)} title="Send test"><Send className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => schedule(m.id)} title="Schedule"><Calendar className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" disabled={busy === m.id} onClick={() => regen(m.id)} title="Regenerate (1 credit)">
                          {busy === m.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => dup(m.id)} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => arch(m.id)} title="Archive"><Archive className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Subject line">
                        <Input value={m.subject_line} onChange={(e) => patchMsg(m.id, { subject_line: e.target.value })} />
                      </Field>
                      <Field label="Preview text">
                        <Input value={m.preview_text ?? ""} onChange={(e) => patchMsg(m.id, { preview_text: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Body (markdown)">
                      <Textarea value={m.body_markdown ?? ""} onChange={(e) => patchMsg(m.id, { body_markdown: e.target.value })} rows={8} />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="CTA text">
                        <Input value={m.cta_text ?? ""} onChange={(e) => patchMsg(m.id, { cta_text: e.target.value })} />
                      </Field>
                      <Field label="CTA URL placeholder">
                        <Input value={m.cta_url_placeholder ?? ""} onChange={(e) => patchMsg(m.id, { cta_url_placeholder: e.target.value })} />
                      </Field>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      <span><strong>Goal:</strong> {m.goal}</span>
                      <span><strong>Metric:</strong> {m.success_metric}</span>
                      {m.scheduled_at && <span><strong>Scheduled:</strong> {new Date(m.scheduled_at).toLocaleString()}</span>}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate email sequence</DialogTitle>
            <DialogDescription>3 credits — uses your brand profile and offer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Type">
              <select value={genState.type} onChange={(e) => setGenState({ ...genState, type: e.target.value as any })}
                className="w-full rounded-md border bg-background px-2 py-2 text-sm">
                {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{CAMPAIGN_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Tone">
              <Input value={genState.tone} onChange={(e) => setGenState({ ...genState, tone: e.target.value })} />
            </Field>
            <Field label="Length">
              <div className="flex gap-2">
                {[3, 5, 7].map((n) => (
                  <Button key={n} type="button" variant={genState.length === n ? "default" : "outline"}
                    onClick={() => setGenState({ ...genState, length: n as 3 | 5 | 7 })} size="sm">{n} emails</Button>
                ))}
              </div>
            </Field>
            <Field label="Audience note (optional)">
              <Textarea value={genState.audience_note} onChange={(e) => setGenState({ ...genState, audience_note: e.target.value })} rows={3} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={genLoading} className="bg-brand-gradient text-primary-foreground">
              {genLoading ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AnalyticsCard({ analytics }: { analytics: any }) {
  if (!analytics) return <Skeleton className="h-28 w-full rounded-2xl" />;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const stats = [
    { label: "Sent", value: analytics.counts.sent },
    { label: "Delivered", value: analytics.counts.delivered },
    { label: "Open rate", value: pct(analytics.rates.open_rate) },
    { label: "Click rate", value: pct(analytics.rates.click_rate) },
    { label: "Unsub rate", value: pct(analytics.rates.unsub_rate) },
    { label: "Bounce rate", value: pct(analytics.rates.bounce_rate) },
    { label: "Conversion", value: pct(analytics.rates.conversion_rate) },
    { label: "Revenue", value: `$${analytics.revenue_attributed}` },
  ];
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">Performance</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-background/50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="text-lg font-semibold mt-1">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border bg-background/50 p-3">
          <div className="text-muted-foreground">Best subject line</div>
          <div className="font-medium mt-1 line-clamp-2">{analytics.best_subject_line}</div>
        </div>
        <div className="rounded-xl border bg-background/50 p-3">
          <div className="text-muted-foreground">Best CTA</div>
          <div className="font-medium mt-1 line-clamp-2">{analytics.best_cta}</div>
        </div>
      </div>
    </div>
  );
}
